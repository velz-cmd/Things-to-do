import { buildDiscoverRadarFeedSafe } from "@/lib/discover/radar-feed";
import { emptyRadarFeedPayload } from "@/lib/discover/radar-feed-fallback";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

export const maxDuration = 60;

/** Unified Discover feed — gaps, pulse metrics, domain radars. Always returns usable JSON. */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 24);
  const bounded = Math.min(Math.max(limit, 1), 48);

  return safeApiGet(
    req,
    () => buildDiscoverRadarFeedSafe(bounded),
    {
      scope: "discover/radar-feed",
      fallback: emptyRadarFeedPayload({ degraded: true }),
      cacheControl: API_CACHE.publicShort,
      rateLimit: { keyPrefix: "discover:radar-feed", limit: 80, windowSeconds: 60 },
    },
  );
}
