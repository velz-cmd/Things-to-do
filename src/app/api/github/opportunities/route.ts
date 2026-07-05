import { hasGithubToken } from "@/lib/github/client";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

const FALLBACK = {
  phase: "github-v1" as const,
  tokenConfigured: false,
  count: 0,
  opportunities: [] as Awaited<ReturnType<typeof cachedScanAllOpportunities>>,
  message: "GitHub opportunities temporarily unavailable — showing last cached data when possible.",
};

/** Radar feed — unfunded high-value GitHub repositories (cached + rate limited). */
export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const opportunities = await cachedScanAllOpportunities();
      return {
        phase: "github-v1",
        tokenConfigured: hasGithubToken(),
        count: opportunities.length,
        opportunities,
        message: hasGithubToken()
          ? "Live GitHub GraphQL + REST scan"
          : "Set GITHUB_TOKEN for live PR/review ingestion",
      };
    },
    {
      scope: "github/opportunities",
      fallback: FALLBACK,
      cacheControl: API_CACHE.publicShort,
      rateLimit: { keyPrefix: "github:opportunities", limit: 30, windowSeconds: 60 },
    },
  );
}
