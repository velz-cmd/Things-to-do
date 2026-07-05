import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { CONFIG_FALLBACK, buildPublicConfig } from "@/lib/config/public-config";

export async function GET(req: Request) {
  return safeApiGet(req, () => buildPublicConfig(), {
    scope: "config",
    fallback: CONFIG_FALLBACK,
    cacheControl: API_CACHE.publicShort,
    rateLimit: { limit: 120, windowSeconds: 60, keyPrefix: "config" },
    redisCache: { key: "config:public", ttlSeconds: 60, staleSeconds: 180 },
  });
}
