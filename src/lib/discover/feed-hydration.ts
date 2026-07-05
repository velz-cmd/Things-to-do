import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { buildSensorCommunityPreviewRows } from "@/lib/discover/sensor-community-rows";
import type { DiscoverRadarFeedPayload, TrendingValueGap } from "@/lib/discover/types";

/** Discover should never look empty — attach catalog preview rows when live signals are thin. */
export function hydrateDiscoverGaps(
  gaps: TrendingValueGap[],
  limit = 8,
): TrendingValueGap[] {
  if (gaps.length >= 3) return gaps;

  const preview = buildSensorCommunityPreviewRows("all", null, limit, "gaps");
  return dedupeTrendingGaps([...gaps, ...preview]).slice(0, limit);
}

export function isUsefulDiscoverFeed(feed: DiscoverRadarFeedPayload): boolean {
  if ((feed.gaps?.length ?? 0) >= 3) return true;
  if ((feed.realSignalCount ?? 0) > 0) return true;
  if ((feed.ossSignalCount ?? 0) > 0) return true;
  if (
    (feed.domainRadars?.oss?.cards?.length ?? 0) > 0 ||
    (feed.domainRadars?.music?.cards?.length ?? 0) > 0 ||
    (feed.domainRadars?.dao?.cards?.length ?? 0) > 0
  ) {
    return true;
  }
  return !feed.degraded;
}
