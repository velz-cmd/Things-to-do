import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { getDashboardStats } from "@/lib/deputy/orchestrator";

const STATS_FALLBACK = {
  degraded: true,
  moneyRecoveredUsd: 0,
  subscriptionsCancelled: 0,
  executionCostUsd: 0,
  netGainUsd: 0,
  tasksCompleted: 0,
  activeTasks: 0,
  recentTasks: [] as unknown[],
};

export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const stats = await getDashboardStats();
      return stats as Record<string, unknown>;
    },
    {
      scope: "stats",
      fallback: STATS_FALLBACK,
      cacheControl: API_CACHE.publicShort,
      rateLimit: { limit: 60, windowSeconds: 60, keyPrefix: "stats" },
    },
  );
}
