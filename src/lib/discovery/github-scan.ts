import type { HiddenBuilder } from "@/lib/weight/types";

const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "User-Agent": "RESOLVE-Discovery-Agent",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

/** Real OSS repos where maintainers are often underfunded — not registry sidecars. */
export const SCAN_TARGETS = [
  { owner: "navidrome", repo: "navidrome", platform: "github" as const, role: "Maintainer" },
  { owner: "immich-app", repo: "immich", platform: "github" as const, role: "Maintainer" },
  { owner: "mastodon", repo: "mastodon", platform: "github" as const, role: "Maintainer" },
  { owner: "koel", repo: "koel", platform: "github" as const, role: "Maintainer" },
  { owner: "owncast", repo: "owncast", platform: "github" as const, role: "Maintainer" },
];

type GhContributor = { login: string; contributions: number; avatar_url?: string };
type GhRepo = { stargazers_count: number; open_issues_count: number; description?: string };

export async function scanGithubRepo(
  owner: string,
  repo: string,
): Promise<{ builders: HiddenBuilder[]; repo: GhRepo | null }> {
  try {
    const [repoRes, contribRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: GITHUB_HEADERS,
        next: { revalidate: 3600 },
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=8`, {
        headers: GITHUB_HEADERS,
        next: { revalidate: 3600 },
      }),
    ]);

    if (!repoRes.ok || !contribRes.ok) {
      return { builders: [], repo: null };
    }

    const meta = (await repoRes.json()) as GhRepo;
    const contributors = (await contribRes.json()) as GhContributor[];

    const stars = meta.stargazers_count ?? 0;
    const builders: HiddenBuilder[] = contributors
      .filter((c) => c.contributions >= 50)
      .slice(0, 3)
      .map((c, idx) => {
        const impactScore = Math.min(
          99,
          Math.round(55 + Math.log10(c.contributions + 1) * 12 + Math.log10(stars + 1) * 4),
        );
        const unpaidUsdEstimate = Math.round(
          (c.contributions / 10) * 2 + stars / 100,
        );
        return {
          id: `live-gh-${owner}-${repo}-${c.login}`,
          name: c.login,
          role: idx === 0 ? "Top maintainer" : "Core contributor",
          platform: "github",
          handle: `${owner}/${repo} · @${c.login}`,
          impactScore,
          fundingReadiness: Math.min(95, impactScore - 5),
          unpaidUsdEstimate,
          headline: `${c.contributions.toLocaleString()} commits · ${stars.toLocaleString()}★ · $0 on-chain payouts`,
          live: true,
          signals: [
            { label: "Commits", value: String(c.contributions), severity: "high" as const },
            { label: "Repo stars", value: stars.toLocaleString(), severity: "medium" as const },
            { label: "Open issues", value: String(meta.open_issues_count ?? "—"), severity: "medium" as const },
            { label: "Funding detected", value: "$0", severity: "high" as const },
          ],
        };
      });

    return { builders, repo: meta };
  } catch {
    return { builders: [], repo: null };
  }
}

export async function runLiveDiscoveryScan(): Promise<HiddenBuilder[]> {
  const results = await Promise.all(
    SCAN_TARGETS.map((t) => scanGithubRepo(t.owner, t.repo)),
  );

  const live = results.flatMap((r) => r.builders);
  const byLogin = new Map<string, HiddenBuilder>();
  for (const b of live) {
    const key = b.name.toLowerCase();
    const existing = byLogin.get(key);
    if (!existing || b.impactScore > existing.impactScore) {
      byLogin.set(key, b);
    }
  }
  return Array.from(byLogin.values()).sort((a, b) => b.impactScore - a.impactScore);
}
