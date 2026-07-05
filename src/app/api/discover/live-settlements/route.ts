import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { buildLiveSettlements } from "@/lib/discover/live-settlements";

const FALLBACK = {
  ok: true,
  live: false,
  rows: [],
  updatedAt: new Date().toISOString(),
  degraded: true,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "12");

  return safeApiGet(
    req,
    async () => {
      const payload = await buildLiveSettlements(Number.isFinite(limit) ? limit : 12);
      return payload as unknown as Record<string, unknown>;
    },
    {
      scope: "discover/live-settlements",
      fallback: FALLBACK,
      cacheControl: API_CACHE.publicShort,
      redisCache: { key: `discover:live-settlements:${limit}`, ttlSeconds: 20, staleSeconds: 60 },
    },
  );
}
