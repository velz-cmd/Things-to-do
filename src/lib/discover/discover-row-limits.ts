import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { isVerifiedGap } from "@/lib/discover/gap-rules";
import { buildSensorCommunityPreviewRows } from "@/lib/discover/sensor-community-rows";
import type { DomainRadarId, DiscoverRadarFeedPayload, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

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
  role: DiscoverRole = "all",
  installedSlugs: string[] = [],
): TrendingValueGap[] {
  if (filtered.length > 0) {
    return filtered.slice(0, limit);
  }
  if (!feed) {
    return buildSensorCommunityPreviewRows(role, installedSlugs, limit);
  }

  const verified = dedupeTrendingGaps((feed.gaps ?? []).filter(isVerifiedGap));
  if (verified.length > 0) {
    return verified.slice(0, limit);
  }

  const preview = dedupeTrendingGaps([
    ...(feed.gaps ?? []),
    ...feed.domainRadars.oss.cards,
    ...feed.domainRadars.music.cards,
    ...feed.domainRadars.dao.cards,
    ...buildSensorCommunityPreviewRows(role, installedSlugs, limit),
  ]).sort((a, b) => gapRank(b) - gapRank(a));

  return preview.slice(0, limit);
}

export function collectRadarRows(
  radarId: DomainRadarId,
  radarCards: TrendingValueGap[],
  feedGaps: TrendingValueGap[],
  role: DiscoverRole = "all",
  installedSlugs: string[] = [],
): TrendingValueGap[] {
  const limit = RADAR_MAX_ROWS[radarId];
  const merged = dedupeTrendingGaps(
    radarCards.length > 0 ? radarCards : feedGaps.length > 0 ? feedGaps : filterSensorRowsForRadar(radarId, role, installedSlugs),
  );
  return merged.slice(0, limit);
}

function filterSensorRowsForRadar(
  radarId: DomainRadarId,
  role: DiscoverRole,
  installedSlugs: string[],
): TrendingValueGap[] {
  const all = buildSensorCommunityPreviewRows(role, installedSlugs, 8);
  if (radarId === "oss") {
    return all.filter((g) => g.domain === "oss" || g.communitySlug === "react" || g.communitySlug === "linux");
  }
  if (radarId === "music") {
    return all.filter((g) => g.domain === "music" || g.communitySlug === "jellyfin");
  }
  return all.filter((g) => g.domain === "research" || g.communitySlug === "open-research");
}
