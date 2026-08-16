import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { runLiveDiscoveryScan, scanGithubRepo } from "@/lib/discovery/github-scan";

const BUILDERS_FALLBACK = {
  degraded: true,
  index: "unpaid-value",
  discovered: 0,
  liveScanned: 0,
  builders: [] as unknown[],
  updatedAt: new Date().toISOString(),
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");

  if (repo?.includes("/")) {
    const [owner, name] = repo.split("/");
    return safeApiGet(
      req,
      async () => {
        const scanned = await scanGithubRepo(owner, name);
        return {
          repo: `${owner}/${name}`,
          discovered: scanned.builders.length,
          builders: scanned.builders,
          meta: scanned.repo,
        } as Record<string, unknown>;
      },
      {
        scope: "discover/builders/repo",
        fallback: { ...BUILDERS_FALLBACK, repo: repo ?? "" },
        cacheControl: API_CACHE.publicShort,
        rateLimit: { limit: 20, windowSeconds: 60, keyPrefix: "discover:builders:repo" },
        redisCache: {
          key: `discover:builders:repo:${owner}/${name}`,
          ttlSeconds: 120,
          staleSeconds: 360,
        },
      },
    );
  }

  const platform = searchParams.get("platform") ?? undefined;
  const minScore = searchParams.get("minScore");
  const liveOnly = searchParams.get("live") === "true";
  const cacheKey = `discover:builders:${platform ?? "all"}:${minScore ?? "any"}:${liveOnly}`;

  return safeApiGet(
    req,
    async () => {
      // This endpoint used to merge a hardcoded list of invented people
      // ("Lena Okonkwo", impactScore 91, $4,200 unpaid, "680k monthly
      // downloads") into the live scan, with no marker separating the two -
      // a consumer could not tell a real contributor from a fabricated one.
      // Discovery now returns only what was actually scanned. An empty result
      // is the correct answer when nothing real was found.
      const merged = await runLiveDiscoveryScan();

      merged.sort((a, b) => b.impactScore - a.impactScore);

      return {
        index: "unpaid-value",
        discovered: merged.length,
        liveScanned: merged.length,
        builders: merged.slice(0, 20),
        updatedAt: new Date().toISOString(),
        thesis: "Find who should be paid — before anyone uploads a CSV or builds another registry",
        scanRepos: "GET ?repo=navidrome/navidrome",
      } as Record<string, unknown>;
    },
    {
      scope: "discover/builders",
      fallback: BUILDERS_FALLBACK,
      cacheControl: API_CACHE.publicShort,
      rateLimit: { limit: 30, windowSeconds: 60, keyPrefix: "discover:builders" },
      redisCache: { key: cacheKey, ttlSeconds: 120, staleSeconds: 360 },
    },
  );
}
