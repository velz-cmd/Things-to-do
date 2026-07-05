"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverTrendingSkeleton } from "@/components/resolve/discover/discover-skeletons";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { filterGapsByNeedType } from "@/lib/discover/need-types";
import { LANE_PURPOSE, WORKSPACE_LANE_LABELS } from "@/lib/discover/discover-lane-copy";
import { sortByOpportunityScore, type OpportunitySortKey } from "@/lib/discover/opportunity-score";
import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import { DiscoverAttachRail } from "@/components/resolve/discover/discover-attach-rail";
import { DiscoverFeatureRow } from "@/components/resolve/discover/discover-feature-row";
import { collectGapsRows, GAPS_MAX_ROWS } from "@/lib/discover/discover-row-limits";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { ACTION_ERRORS } from "@/lib/copy/action-errors";

import type { DiscoverWorkspaceLane } from "@/components/resolve/discover/discover-workspace-nav";

type DiscoverTrendingGapsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  className?: string;
  limit?: number;
  onSwitchLane?: (lane: DiscoverWorkspaceLane) => void;
};

export function DiscoverTrendingGaps({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  needType = "all",
  className,
  limit = GAPS_MAX_ROWS,
  onSwitchLane: _onSwitchLane,
}: DiscoverTrendingGapsProps) {
  const { feed, loading, error, refresh } = useDiscoverRadarFeed();
  const { state: connections } = useUserConnections();
  const [sortKey, setSortKey] = useState<OpportunitySortKey>("reward");

  const filtered = useMemo(() => {
    const gaps = filterGapsByNeedType(feed?.gaps ?? [], needType);
    const q = query.trim().toLowerCase();
    let rows = gaps;
    if (q) {
      rows = gaps.filter(
        (g) =>
          g.headline.toLowerCase().includes(q) ||
          g.domain.includes(q) ||
          g.why.toLowerCase().includes(q) ||
          (g.needType?.includes(q) ?? false),
      );
    }
    return sortByOpportunityScore(dedupeTrendingGaps(rows), sortKey);
  }, [feed?.gaps, query, needType, sortKey]);

  const displayRows = useMemo(
    () =>
      collectGapsRows(feed, filtered, limit ?? GAPS_MAX_ROWS, role, connections),
    [feed, filtered, limit, role, connections],
  );

  const subtitle =
    feed?.realSignalCount != null && feed.realSignalCount > 0
      ? `${feed.realSignalCount} verified on ledger · ${LANE_PURPOSE.gaps}`
      : LANE_PURPOSE.gaps;

  return (
    <DiscoverPremiumSection
      id="trending"
      title={WORKSPACE_LANE_LABELS.gaps}
      subtitle={subtitle}
      className={className}
      actions={
        <DiscoverSectionRefresh
          sectionId="trending-gaps"
          onRefresh={refresh}
          lastUpdated={feed?.updatedAt}
        />
      }
    >
      {feed?.degraded && !error && (
        <DiscoverDegradedHint onRefresh={() => void refresh()} className="mb-3" />
      )}

      {loading ? (
        <DiscoverTrendingSkeleton />
      ) : error && !feed ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void refresh()} />
        </DiscoverStatePanel>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {displayRows.length === 0 && (
            <DiscoverAttachRail
              context="gaps"
              role={role}
              needType={needType}
              signedIn={signedIn}
            />
          )}

          <div className="min-w-0 flex-1">
            {displayRows.length > 0 && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Sort by
                  </span>
                  {(
                    [
                      ["reward", "Reward"],
                      ["urgency", "Urgency"],
                      ["confidence", "Confidence"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSortKey(key)}
                      className={clsx(
                        "rounded-lg border px-2.5 py-1 text-[10px] font-medium transition",
                        sortKey === key
                          ? "border-resolve-accent/40 bg-resolve-accent/15 text-white"
                          : "border-white/10 text-resolve-muted hover:text-white",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ul className="divide-y divide-white/[0.06]">
                  {displayRows.map((gap, i) => (
                    <DiscoverFeatureRow
                      key={gap.id}
                      gap={gap}
                      signedIn={signedIn}
                      intent={intent}
                      role={role}
                      rank={i + 1}
                      surface="trending-gaps"
                      lane="gaps"
                    />
                  ))}
                </ul>
              </>
            )}

            {displayRows.length === 0 && (
              <DiscoverStatePanel variant="empty">
                <p className="text-sm text-resolve-muted">
                  {ACTION_ERRORS.discoveryEmpty}
                </p>
                <DiscoverRetryButton onClick={() => void refresh()} />
              </DiscoverStatePanel>
            )}
          </div>
        </div>
      )}
    </DiscoverPremiumSection>
  );
}
