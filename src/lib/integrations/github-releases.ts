import { env } from "@/lib/integrations/config";

/**
 * Real GitHub Releases ingestion (Phase 2 item 2) - not the PR/issue
 * title-keyword heuristic in github/funding-activity.ts, which only
 * guesses "release_work" from words like "release" or "changelog"
 * appearing in a title. This reads GitHub's actual Releases API.
 *
 * A release proves only that a release was published - not adoption, not
 * security remediation, not economic value. Those require separate
 * evidence (see security-release linking, item 3).
 */
export type GithubRelease = {
  id: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  htmlUrl: string;
  author: string | null;
  draft: boolean;
  prerelease: boolean;
};

type RawRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  html_url: string;
  author?: { login?: string } | null;
  draft: boolean;
  prerelease: boolean;
};

async function releasesFetch(url: string): Promise<RawRelease[] | null> {
  const token = env("GITHUB_TOKEN");
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RESOLVE-Capital-Flow",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as RawRelease[];
  } catch {
    return null;
  }
}

/**
 * Fetches recent releases for a repository. Draft releases are excluded
 * unconditionally - they must never enter public Discover inventory.
 * Prerelease state is preserved so callers can decide how to present it,
 * never silently treated as a stable release.
 */
export async function fetchReleasesForRepo(
  owner: string,
  repo: string,
  perPage = 10,
): Promise<GithubRelease[]> {
  const raw = await releasesFetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}`,
  );
  if (!raw) return [];

  return raw
    .filter((release) => !release.draft)
    .map((release) => ({
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      author: release.author?.login ?? null,
      draft: release.draft,
      prerelease: release.prerelease,
    }));
}
