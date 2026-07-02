import type { FundingOpportunity } from "@/lib/github/types";
import { readOssOpportunitiesForDiscover } from "@/lib/github/oss-scan-store";
import { cacheDelete, cacheGetOrSet } from "@/lib/cache/kv";

/** Shared across Vercel instances when Upstash is configured. */
const CACHE_TTL_SECONDS = 60;
const CACHE_KEY = "resolve:oss:opportunities";

export async function cachedScanAllOpportunities(): Promise<FundingOpportunity[]> {
  return cacheGetOrSet(
    CACHE_KEY,
    CACHE_TTL_SECONDS,
    async () => {
      const { opportunities } = await readOssOpportunitiesForDiscover();
      return opportunities;
    },
  );
}

export async function clearOssOpportunityCache() {
  await cacheDelete(CACHE_KEY);
}

export async function lastOssScanAt(): Promise<string | null> {
  const { meta } = await readOssOpportunitiesForDiscover();
  return meta.scannedAt;
}
