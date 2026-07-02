import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { isVerifiedGap } from "@/lib/discover/gap-rules";
import type { DomainRadarId, DiscoverRadarFeedPayload, TrendingValueGap } from "@/lib/discover/types";

export const GAPS_MAX_ROWS = 5;
export const BOARD_MAX_ROWS = 5;

export const RADAR_MAX_ROWS: Record<DomainRadarId, number> = {
  oss: 3,
  music: 4,
  dao: 5,
};

function gapRank(gap: TrendingValueGap): number {
  return gap.opportunityScorecard?.composite ?? gap.trendScore;
}

/** Verified ledger gaps first, then live scans / radar bundles as preview rows. */
export function collectGapsRows(
  feed: DiscoverRadarFeedPayload | null | undefined,
  filtered: TrendingValueGap[],
  limit = GAPS_MAX_ROWS,
): TrendingValueGap[] {
  if (filtered.length > 0) {
    return filtered.slice(0, limit);
  }
  if (!feed) return [];

  const verified = dedupeTrendingGaps((feed.gaps ?? []).filter(isVerifiedGap));
  if (verified.length > 0) {
    return verified.slice(0, limit);
  }

  const preview = dedupeTrendingGaps([
    ...(feed.gaps ?? []),
    ...feed.domainRadars.oss.cards,
    ...feed.domainRadars.music.cards,
    ...feed.domainRadars.dao.cards,
  ]).sort((a, b) => gapRank(b) - gapRank(a));

  return preview.slice(0, limit);
}

export function collectRadarRows(
  radarId: DomainRadarId,
  radarCards: TrendingValueGap[],
  feedGaps: TrendingValueGap[],
): TrendingValueGap[] {
  const limit = RADAR_MAX_ROWS[radarId];
  const merged = dedupeTrendingGaps(radarCards.length > 0 ? radarCards : feedGaps);
  return merged.slice(0, limit);
}
