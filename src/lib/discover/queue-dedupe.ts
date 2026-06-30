import type { FundableOpportunity } from "@/lib/capital/community-yield";
import type { TrendingValueGap } from "@/lib/discover/types";

/** Program IDs already surfaced in trending — queue must not duplicate them. */
export function trendingProgramIds(gaps: TrendingValueGap[]): Set<string> {
  const ids = new Set<string>();
  for (const g of gaps) {
    if (g.programId) ids.add(g.programId);
    if (g.id.startsWith("program-")) {
      ids.add(g.id.slice("program-".length));
    }
  }
  return ids;
}

export function dedupeQueueWithTrending(
  opportunities: FundableOpportunity[],
  gaps: TrendingValueGap[],
): FundableOpportunity[] {
  const inTrending = trendingProgramIds(gaps);
  return opportunities.filter((o) => !inTrending.has(o.programId));
}
