"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverTrendingSkeleton } from "@/components/resolve/discover/discover-skeletons";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { filterGapsByNeedType } from "@/lib/discover/need-types";
import { sortByOpportunityScore, type OpportunitySortKey } from "@/lib/discover/opportunity-score";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import { DiscoverGapsEmpty } from "@/components/resolve/discover/discover-gaps-empty";
import { GAPS_TAB_INTRO } from "@/lib/discover/gaps-empty-state";
import {
  DiscoverDegradedHint,
  DiscoverRetryButton,
  DiscoverStatePanel,
} from "@/components/resolve/discover/discover-state-panel";

type DiscoverTrendingGapsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  className?: string;
  limit?: number;
};

export function DiscoverTrendingGaps({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  needType = "all",
  className,
  limit,
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
    return sortByOpportunityScore(rows, sortKey);
  }, [feed?.gaps, query, needType, sortKey]);

  const subtitle =
    feed?.realSignalCount != null
      ? `Funder lane — ${feed.realSignalCount} ledger-verified signals ranked by opportunity score`
      : "Funder lane — ranked unfunded work from ledger authorizations and live scans";

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
      ) : !filtered.length ? (
        <DiscoverGapsEmpty needType={needType} role={role} signedIn={signedIn} degraded={feed?.degraded} />
      ) : (
        <>
          <p className="mb-3 text-xs leading-relaxed text-resolve-muted">{GAPS_TAB_INTRO}</p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
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
          <div className="grid gap-3 lg:grid-cols-2">
            {(limit ? filtered.slice(0, limit) : filtered).map((gap, i) => (
              <DiscoverActionCard
                key={gap.id}
                gap={gap}
                signedIn={signedIn}
                intent={intent}
                role={role}
                rank={i + 1}
                surface="trending-gaps"
              />
            ))}
          </div>
        </>
      )}
    </DiscoverPremiumSection>
  );
}
