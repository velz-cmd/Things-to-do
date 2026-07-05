import { buildDiscoverRadar } from "@/lib/discover/radar";
import { withTimeout } from "@/lib/discover/fetch-timeout";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

export const maxDuration = 60;

const RADAR_BUILD_TIMEOUT_MS = 12_000;
const RADAR_CACHE_TTL = 30;

const RADAR_FALLBACK = {
  ok: true,
  live: false,
  activity: [],
  graph: { nodes: [], edges: [] },
  timeline: [],
  metrics: {
    topNodes: [],
    fundingEntropy: {
      entropy: 0,
      maxEntropy: 0,
      concentrationPct: 0,
      evidence: "Radar temporarily unavailable.",
    },
  },
  emptyReason: "Showing cached radar when available.",
  updatedAt: new Date().toISOString(),
};

/** Discover global radar — authorizations, timeline, graph (Redis-backed cache). */
export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const radar = await cacheGetOrSet(`discover:radar:v1`, RADAR_CACHE_TTL, async () => {
        const built = await withTimeout(buildDiscoverRadar(), RADAR_BUILD_TIMEOUT_MS, null);
        if (!built) return RADAR_FALLBACK;
        return built;
      });
      return radar;
    },
    {
      scope: "discover/radar",
      fallback: RADAR_FALLBACK,
      cacheControl: API_CACHE.privateShort,
      rateLimit: { keyPrefix: "discover:radar", limit: 40, windowSeconds: 60 },
    },
  );
}
