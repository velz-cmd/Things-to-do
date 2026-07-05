import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { getTreasuryStats } from "@/lib/treasury/distribute";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { seedContributorRegistry } from "@/lib/registry/seed";
import { seedProductionArtistRegistry } from "@/lib/registry/production-artists";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";

const TREASURY_FALLBACK = {
  degraded: true,
  totalDistributedUsd: 0,
  batchCount: 0,
  contributorCount: 0,
  recentBatches: [] as unknown[],
  missionSettledUsd: 0,
  balanceUsd: 0,
  treasuryUsd: 0,
  liveArc: false,
  canDistributeOnChain: false,
  treasuryMessage: "Treasury temporarily unavailable",
};

export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const [stats, arc] = await Promise.all([getTreasuryStats(), getArcReadiness()]);
      return {
        ...stats,
        balanceUsd: arc.balanceUsd ?? 0,
        treasuryUsd: arc.balanceUsd ?? 0,
        liveArc: arc.liveArc,
        canDistributeOnChain: arc.canDistributeOnChain,
        treasuryMessage: arc.message,
      } as Record<string, unknown>;
    },
    {
      scope: "treasury",
      fallback: TREASURY_FALLBACK,
      cacheControl: API_CACHE.publicShort,
      rateLimit: { limit: 60, windowSeconds: 60, keyPrefix: "treasury" },
      redisCache: { key: "treasury:stats", ttlSeconds: 45, staleSeconds: 135 },
    },
  );
}

export async function POST() {
  if (isDeputyDemoMode()) {
    const seeded = await seedContributorRegistry();
    return Response.json({ ok: true, seeded, source: "legacy" });
  }
  const result = await seedProductionArtistRegistry();
  return Response.json({ ok: true, ...result, source: "production" });
}
