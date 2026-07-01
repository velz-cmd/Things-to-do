import type { FundingOpportunity } from "@/lib/github/types";
import { readOssOpportunitiesForDiscover } from "@/lib/github/oss-scan-store";

let memory: { data: FundingOpportunity[]; at: number; scannedAt: string } | null = null;

/** In-process buffer on top of Postgres OSS scan store (cron-refreshed). */
const MEMORY_TTL_MS = 60_000;

export async function cachedScanAllOpportunities(): Promise<FundingOpportunity[]> {
  const now = Date.now();
  if (memory && now - memory.at < MEMORY_TTL_MS) {
    return memory.data;
  }

  const { opportunities, meta } = await readOssOpportunitiesForDiscover();
  memory = { data: opportunities, at: now, scannedAt: meta.scannedAt };
  return opportunities;
}

export function clearOssOpportunityCache() {
  memory = null;
}

export function lastOssScanAt(): string | null {
  return memory?.scannedAt ?? null;
}
