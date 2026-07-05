import { buildDiscoverRadarFeedSafe } from "@/lib/discover/radar-feed";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

/** @deprecated Prefer GET /api/discover/radar-feed */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12);
  const bounded = Math.min(Math.max(limit, 1), 24);

  return safeApiGet(
    req,
    async () => {
      const feed = await buildDiscoverRadarFeedSafe(bounded);
      return {
        ok: true,
        gaps: feed.gaps.slice(0, bounded),
        updatedAt: feed.updatedAt,
      };
    },
    {
      scope: "discover/trending",
      fallback: { ok: true, gaps: [], updatedAt: new Date().toISOString() },
      cacheControl: API_CACHE.publicShort,
      rateLimit: { keyPrefix: "discover:trending", limit: 60, windowSeconds: 60 },
    },
  );
}
