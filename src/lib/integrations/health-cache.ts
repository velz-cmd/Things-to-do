import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { cacheDelete, cacheGetOrSet } from "@/lib/cache/kv";

type HealthResult = Awaited<ReturnType<typeof runIntegrationHealthCheck>>;

const CACHE_KEY = "resolve:integrations:health";
/** Avoid 20+ external pings on every profile/discover request. */
const CACHE_TTL_SECONDS = 3 * 60;

export async function getCachedIntegrationHealthCheck(): Promise<HealthResult> {
  return cacheGetOrSet(CACHE_KEY, CACHE_TTL_SECONDS, runIntegrationHealthCheck);
}

export async function clearIntegrationHealthCache() {
  await cacheDelete(CACHE_KEY);
}
