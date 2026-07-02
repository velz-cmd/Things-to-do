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
import { sortByOpportunityScore, type OpportunitySortKey } from "@/lib/discover/opportunity-score";
import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { isVerifiedGap } from "@/lib/discover/gap-rules";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";
import { DiscoverAttachRail } from "@/components/resolve/discover/discover-attach-rail";
import { DiscoverFeatureRow } from "@/components/resolve/discover/discover-feature-row";
import { collectGapsRows, GAPS_MAX_ROWS } from "@/lib/discover/discover-row-limits";

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
  const [sortKey, setSortKey] = useState<OpportunitySortKey>("composite");

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
    () => collectGapsRows(feed, filtered, limit ?? GAPS_MAX_ROWS),
    [feed, filtered, limit],
  );

  const hasVerified = displayRows.some(isVerifiedGap);
  const previewOnly = displayRows.length > 0 && !hasVerified;

  const subtitle =
    feed?.realSignalCount != null
      ? `${feed.realSignalCount} ledger-verified signals · top ${GAPS_MAX_ROWS} ranked rows`
      : `Top ${GAPS_MAX_ROWS} opportunities from live scans and ledger`;

  return (
    <DiscoverPremiumSection
      id="trending"
      title="Trending value gaps"
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

      {loading && !feed ? (
        <DiscoverTrendingSkeleton />
      ) : error && !feed ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void refresh()} />
        </DiscoverStatePanel>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <DiscoverAttachRail
            context="gaps"
            role={role}
            needType={needType}
            signedIn={signedIn}
          />

          <div className="min-w-0 flex-1">
            {previewOnly && (
              <p className="mb-2 text-[11px] text-amber-200/80">
                Live scan previews — attach a community and connect sensors for ledger-verified ranks.
              </p>
            )}

            {displayRows.length > 0 && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Sort by
                  </span>
                  {(
                    [
                      ["composite", "Score"],
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
                      maxActions={2}
                    />
                  ))}
                </ul>
              </>
            )}

            {displayRows.length === 0 && (
              <DiscoverStatePanel variant="empty">
                <p className="text-sm text-resolve-muted">
                  Sensors are syncing — attach GitHub or a community on the left to populate ranked gaps.
                </p>
              </DiscoverStatePanel>
            )}
          </div>
        </div>
      )}
    </DiscoverPremiumSection>
  );
}
