import { githubFetch } from "@/lib/github/client";
import type {
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  RepoIngestResult,
} from "@/lib/github/types";

type GhRepo = {
  full_name: string;
  description?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  pushed_at?: string;
};

type GhContributor = { login: string; id: number; contributions: number; avatar_url?: string };

type GhPr = {
  number: number;
  title: string;
  user: { login: string; id: number };
  state: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  review_comments: number;
  commits: number;
  labels: { name: string }[];
  body?: string;
};

type GhPrFile = { filename: string; additions: number; deletions: number; patch?: string };

type GhIssue = {
  number: number;
  title: string;
  user: { login: string };
  state: string;
  comments: number;
  labels: { name: string }[];
  closed_at?: string;
  updated_at?: string;
  html_url: string;
  pull_request?: unknown;
};

type GhRelease = {
  id: number;
  tag_name: string;
  name?: string;
  author?: { login?: string };
  published_at?: string;
  html_url: string;
  draft: boolean;
};

const GRAPHQL_QUERY = `
  query RepoContributors($owner: String!, $repo: String!, $prCount: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(states: MERGED, first: $prCount, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          number
          title
          mergedAt
          additions
          deletions
          changedFiles
          author { login ... on User { id createdAt } }
          reviews(first: 10) { nodes { author { login } state body createdAt } }
          comments { totalCount }
          labels(first: 8) { nodes { name } }
        }
      }
    }
  }
`;

async function fetchMergedPrsGraphQL(
  owner: string,
  repo: string,
  limit: number,
): Promise<GitHubPullRequest[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "RESOLVE-Capital-Flow-Protocol",
      },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: { owner, repo, prCount: limit },
      }),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        repository?: {
          pullRequests?: {
            nodes?: Array<{
              number: number;
              title: string;
              mergedAt?: string;
              additions: number;
              deletions: number;
              changedFiles: number;
              author?: { login?: string; id?: number };
              reviews?: { nodes?: { author?: { login?: string }; state: string; body?: string; createdAt?: string }[] };
              comments?: { totalCount: number };
              labels?: { nodes?: { name: string }[] };
            }>;
          };
        };
      };
    };

    const nodes = json.data?.repository?.pullRequests?.nodes ?? [];
    return nodes.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author?.login ?? "unknown",
      authorId: pr.author?.id ?? 0,
      state: "closed",
      merged: true,
      mergedAt: pr.mergedAt,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      reviewComments: pr.comments?.totalCount ?? 0,
      commits: 1,
      labels: pr.labels?.nodes?.map((l) => l.name) ?? [],
      sourceUrl: `https://github.com/${owner}/${repo}/pull/${pr.number}`,
      reviews: (pr.reviews?.nodes ?? []).map((review) => ({
        author: review.author?.login ?? "unknown",
        state: review.state,
        body: review.body,
        submittedAt: review.createdAt,
      })),
      files: [],
    }));
  } catch {
    return [];
  }
}

async function enrichPrFiles(
  owner: string,
  repo: string,
  prs: GitHubPullRequest[],
): Promise<GitHubPullRequest[]> {
  const enriched = await Promise.all(
    prs.slice(0, 12).map(async (pr) => {
      if (pr.additions + pr.deletions < 10) return pr;
      const files = await githubFetch<GhPrFile[]>(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files?per_page=20`,
        { revalidate: 3600 },
      );
      if (!files?.length) return pr;
      const patch = files.find((f) => f.patch)?.patch?.slice(0, 1200);
      return {
        ...pr,
        diffSnippet: patch,
        files: files.map((f) => ({
          path: f.filename,
          additions: f.additions,
          deletions: f.deletions,
        })),
      };
    }),
  );
  return enriched;
}

async function fetchContributorProfiles(
  contributors: GhContributor[],
): Promise<GitHubContributor[]> {
  const top = contributors.slice(0, 15);
  const profiles = await Promise.all(
    top.map(async (c) => {
      const user = await githubFetch<{
        id: number;
        login: string;
        avatar_url?: string;
        created_at?: string;
        public_repos?: number;
        followers?: number;
      }>(`https://api.github.com/users/${c.login}`, { revalidate: 7200 });
      return {
        login: c.login,
        id: c.id,
        avatarUrl: user?.avatar_url ?? c.avatar_url,
        accountCreatedAt: user?.created_at,
        publicRepos: user?.public_repos,
        followers: user?.followers,
      };
    }),
  );
  return profiles;
}

/** Ingest a GitHub repository — GraphQL PRs + REST commits/issues/files. */
export async function ingestRepository(
  owner: string,
  repo: string,
  options?: { prLimit?: number },
): Promise<RepoIngestResult | null> {
  const prLimit = options?.prLimit ?? 20;

  const [meta, contribRes, issueRes, releaseRes, graphqlPrs] = await Promise.all([
    githubFetch<GhRepo>(`https://api.github.com/repos/${owner}/${repo}`, { revalidate: 1800 }),
    githubFetch<GhContributor[]>(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=20`,
      { revalidate: 3600 },
    ),
    githubFetch<GhIssue[]>(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=15&sort=updated`,
      { revalidate: 3600 },
    ),
    githubFetch<GhRelease[]>(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`,
      { revalidate: 1800 },
    ),
    fetchMergedPrsGraphQL(owner, repo, prLimit),
  ]);

  if (!meta) return null;

  let pullRequests = graphqlPrs;
  if (!pullRequests.length) {
    const restPrs = await githubFetch<GhPr[]>(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&per_page=${prLimit}`,
      { revalidate: 1800 },
    );
    pullRequests = (restPrs ?? [])
      .filter((p) => p.merged_at)
      .map((p) => ({
        number: p.number,
        title: p.title,
        author: p.user.login,
        authorId: p.user.id,
        state: p.state,
        merged: true,
        mergedAt: p.merged_at ?? undefined,
        additions: p.additions,
        deletions: p.deletions,
        changedFiles: p.changed_files,
        reviewComments: p.review_comments,
        commits: p.commits,
        labels: p.labels.map((l) => l.name),
        body: p.body,
        sourceUrl: `https://github.com/${owner}/${repo}/pull/${p.number}`,
        files: [],
      }));
  }

  pullRequests = await enrichPrFiles(owner, repo, pullRequests);
  const contributors = await fetchContributorProfiles(contribRes ?? []);

  const issues: GitHubIssue[] = (issueRes ?? [])
    .filter((issue) => !issue.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      author: i.user.login,
      state: i.state,
      comments: i.comments,
      labels: i.labels.map((l) => l.name),
      closedAt: i.closed_at,
      updatedAt: i.updated_at,
      sourceUrl: i.html_url,
    }));

  const releases: GitHubRelease[] = (releaseRes ?? [])
    .filter((release) => !release.draft)
    .map((release) => ({
      id: release.id,
      tagName: release.tag_name,
      name: release.name ?? release.tag_name,
      author: release.author?.login ?? owner,
      publishedAt: release.published_at,
      sourceUrl: release.html_url,
    }));

  return {
    owner,
    repo,
    fullName: meta.full_name,
    description: meta.description,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues: meta.open_issues_count,
    defaultBranch: meta.default_branch,
    pushedAt: meta.pushed_at,
    contributors,
    pullRequests: pullRequests.filter((p) => p.merged && p.additions + p.deletions >= 10),
    issues,
    releases,
    ingestedAt: new Date().toISOString(),
  };
}
