import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import {
  buildDiscoverOssIntelligence,
  emptyDiscoverOssIntelligence,
} from "@/lib/discover/oss-intelligence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const repository = url.searchParams.get("repo");
  return safeApiGet(
    request,
    () => buildDiscoverOssIntelligence({ repository }),
    {
      scope: "discover.oss_intelligence",
      fallback: { ...emptyDiscoverOssIntelligence(), ok: false },
      cacheControl: API_CACHE.privateShort,
      rateLimit: { limit: 60, windowSeconds: 60, keyPrefix: "discover:oss-intelligence" },
    },
  );
}
