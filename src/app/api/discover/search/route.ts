import { searchDiscover } from "@/lib/discover/search";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";

const SEARCH_CACHE_TTL = 45;
const EMPTY = {
  ok: true,
  query: "",
  results: [],
  topPrimaryAction: null,
  queueFilter: null,
};

function searchCacheKey(q: string) {
  const normalized = q.trim().toLowerCase().slice(0, 120);
  return `discover:search:${normalized || "__empty__"}`;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  return safeApiGet(
    req,
    async () => {
      if (q.length < 2) {
        return { ...EMPTY, query: q };
      }
      const payload = await cacheGetOrSet(searchCacheKey(q), SEARCH_CACHE_TTL, () =>
        searchDiscover(q),
      );
      return payload;
    },
    {
      scope: "discover/search",
      fallback: EMPTY,
      cacheControl: API_CACHE.privateShort,
      rateLimit: { keyPrefix: "discover:search", limit: 25, windowSeconds: 60 },
      rateLimitStrict: true,
    },
  );
}
