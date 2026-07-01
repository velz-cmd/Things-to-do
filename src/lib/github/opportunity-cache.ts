import { scanAllOpportunities } from "@/lib/github/opportunities";
import type { FundingOpportunity } from "@/lib/github/types";

let cached: { data: FundingOpportunity[]; at: number } | null = null;

/** Shared GitHub scan — one ingest per TTL across radar-feed, trending, radars, board. */
const OSS_SCAN_TTL_MS = 5 * 60_000;

export async function cachedScanAllOpportunities(): Promise<FundingOpportunity[]> {
  if (process.env.CI === "true") return [];

  const now = Date.now();
  if (cached && now - cached.at < OSS_SCAN_TTL_MS) {
    return cached.data;
  }

  const data = await scanAllOpportunities().catch(() => []);
  cached = { data, at: now };
  return data;
}

export function clearOssOpportunityCache() {
  cached = null;
}
