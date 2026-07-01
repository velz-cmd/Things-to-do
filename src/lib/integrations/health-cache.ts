import { runIntegrationHealthCheck } from "@/lib/integrations/health";

type HealthResult = Awaited<ReturnType<typeof runIntegrationHealthCheck>>;

let cached: { result: HealthResult; at: number } | null = null;

/** In-process TTL — avoids 20+ external pings on every profile/discover request. */
const HEALTH_TTL_MS = 3 * 60_000;

export async function getCachedIntegrationHealthCheck(): Promise<HealthResult> {
  const now = Date.now();
  if (cached && now - cached.at < HEALTH_TTL_MS) {
    return cached.result;
  }
  const result = await runIntegrationHealthCheck();
  cached = { result, at: now };
  return result;
}

/** Test / admin hooks */
export function clearIntegrationHealthCache() {
  cached = null;
}
