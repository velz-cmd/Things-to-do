import type {
  GitHubFundingActivityRecord,
  GitHubFundingActivitySnapshot,
  GitHubWorkCategory,
  RepoIngestResult,
} from "@/lib/github/types";

export const GITHUB_WORK_CATEGORIES: GitHubWorkCategory[] = [
  "code",
  "review",
  "documentation",
  "issue_resolution",
  "release_work",
  "support",
  "security",
];

const DOCUMENTATION = /(^|\/)(docs?|documentation|guides?|examples?)\/|\.(md|mdx|rst)$/i;
const SECURITY = /security|vulnerab|cve|advisory|exploit/i;
const SUPPORT = /support|help wanted|question|triage|community/i;
const RELEASE = /release|changelog|version|publish/i;

function includesMatch(values: string[], pattern: RegExp) {
  return values.some((value) => pattern.test(value));
}

export function classifyPullRequest(input: {
  title: string;
  labels: string[];
  files: Array<{ path: string }>;
}): GitHubWorkCategory {
  const text = [input.title, ...input.labels].join(" ");
  if (SECURITY.test(text)) return "security";
  if (RELEASE.test(text)) return "release_work";
  if (SUPPORT.test(text)) return "support";
  if (includesMatch(input.files.map((file) => file.path), DOCUMENTATION) || /docs?|documentation/i.test(text)) {
    return "documentation";
  }
  return "code";
}

export function classifyIssue(input: { title: string; labels: string[] }): GitHubWorkCategory {
  const text = [input.title, ...input.labels].join(" ");
  if (SECURITY.test(text)) return "security";
  if (SUPPORT.test(text)) return "support";
  if (RELEASE.test(text)) return "release_work";
  if (/docs?|documentation/i.test(text)) return "documentation";
  return "issue_resolution";
}

function validDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export function buildGitHubFundingActivity(ingest: RepoIngestResult): GitHubFundingActivitySnapshot {
  const records: GitHubFundingActivityRecord[] = [];

  for (const pullRequest of ingest.pullRequests) {
    if (!pullRequest.merged) continue;
    const sourceUrl = pullRequest.sourceUrl ?? `https://github.com/${ingest.fullName}/pull/${pullRequest.number}`;
    const occurredAt = validDate(pullRequest.mergedAt, ingest.ingestedAt);
    records.push({
      id: `pr:${ingest.fullName}:${pullRequest.number}`,
      category: classifyPullRequest(pullRequest),
      title: pullRequest.title,
      actor: pullRequest.author,
      occurredAt,
      sourceUrl,
      sourceKind: "pull_request",
    });

    for (const [index, review] of (pullRequest.reviews ?? []).entries()) {
      if (!review.author || review.author === pullRequest.author) continue;
      records.push({
        id: `review:${ingest.fullName}:${pullRequest.number}:${review.author}:${index}`,
        category: "review",
        title: `Review on #${pullRequest.number}: ${pullRequest.title}`,
        actor: review.author,
        occurredAt: validDate(review.submittedAt, occurredAt),
        sourceUrl,
        sourceKind: "review",
      });
    }
  }

  for (const issue of ingest.issues) {
    if (issue.state !== "closed") continue;
    records.push({
      id: `issue:${ingest.fullName}:${issue.number}`,
      category: classifyIssue(issue),
      title: issue.title,
      actor: issue.author,
      occurredAt: validDate(issue.closedAt ?? issue.updatedAt, ingest.ingestedAt),
      sourceUrl: issue.sourceUrl ?? `https://github.com/${ingest.fullName}/issues/${issue.number}`,
      sourceKind: "issue",
    });
  }

  for (const release of ingest.releases) {
    records.push({
      id: `release:${ingest.fullName}:${release.id}`,
      category: "release_work",
      title: release.name || release.tagName,
      actor: release.author,
      occurredAt: validDate(release.publishedAt, ingest.ingestedAt),
      sourceUrl: release.sourceUrl,
      sourceKind: "release",
    });
  }

  records.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const counts = Object.fromEntries(GITHUB_WORK_CATEGORIES.map((category) => [category, 0])) as Record<GitHubWorkCategory, number>;
  const contributorMap = new Map<string, { avatarUrl?: string; categories: Partial<Record<GitHubWorkCategory, number>>; total: number }>();
  const avatarByLogin = new Map(ingest.contributors.map((contributor) => [contributor.login.toLowerCase(), contributor.avatarUrl]));

  for (const record of records) {
    counts[record.category] += 1;
    const key = record.actor.toLowerCase();
    const contributor = contributorMap.get(key) ?? { avatarUrl: avatarByLogin.get(key), categories: {}, total: 0 };
    contributor.total += 1;
    contributor.categories[record.category] = (contributor.categories[record.category] ?? 0) + 1;
    contributorMap.set(key, contributor);
  }

  return {
    observedAt: ingest.ingestedAt,
    rangeStart: records.length ? records[records.length - 1]!.occurredAt : null,
    rangeEnd: ingest.ingestedAt,
    records,
    counts,
    contributors: [...contributorMap.entries()]
      .map(([login, contributor]) => ({
        login,
        avatarUrl: contributor.avatarUrl,
        acceptedActivityCount: contributor.total,
        categories: contributor.categories,
      }))
      .sort((left, right) => right.acceptedActivityCount - left.acceptedActivityCount || left.login.localeCompare(right.login)),
  };
}
