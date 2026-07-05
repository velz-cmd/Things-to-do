import { buildDiscoverRadarFeedSafe } from "@/lib/discover/radar-feed";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

/** @deprecated Prefer GET /api/discover/radar-feed */
export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const feed = await buildDiscoverRadarFeedSafe(24);
      return {
        ok: true,
        intelligence: feed.intelligence,
        fundableCount: feed.fundableCount,
        ossSignalCount: feed.ossSignalCount,
        claimHint: feed.claimHint,
        updatedAt: feed.updatedAt,
      };
    },
    {
      scope: "discover/overview",
      fallback: {
        ok: true,
        intelligence: null,
        fundableCount: 0,
        ossSignalCount: 0,
        claimHint: null,
        updatedAt: new Date().toISOString(),
      },
      cacheControl: API_CACHE.publicShort,
      rateLimit: { keyPrefix: "discover:overview", limit: 60, windowSeconds: 60 },
    },
  );
}
