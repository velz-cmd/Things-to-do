import type { TrendingValueGap } from "@/lib/discover/types";

/** One card per ledger program or authorization — no duplicate remix rows. */
export function dedupeTrendingGaps(gaps: TrendingValueGap[]): TrendingValueGap[] {
  const byKey = new Map<string, TrendingValueGap>();

  for (const gap of gaps) {
    const key = gap.proofAuthorizationId
      ? `auth:${gap.proofAuthorizationId}`
      : gap.programId
        ? `program:${gap.programId}`
        : gap.entityPath
          ? `entity:${gap.entityPath}`
          : gap.id;

    const existing = byKey.get(key);
    if (!existing || gap.trendScore > existing.trendScore) {
      byKey.set(key, gap);
    }
  }

  const byHeadline = new Map<string, TrendingValueGap>();
  for (const gap of byKey.values()) {
    const headlineKey = gap.headline.toLowerCase().trim();
    const existing = byHeadline.get(headlineKey);
    if (!existing || gap.trendScore > existing.trendScore) {
      byHeadline.set(headlineKey, gap);
    }
  }

  return [...byHeadline.values()];
}
