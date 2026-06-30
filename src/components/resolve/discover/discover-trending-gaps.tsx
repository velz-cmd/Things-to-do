"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverTrendingSkeleton } from "@/components/resolve/discover/discover-skeletons";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
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
  className?: string;
};

export function DiscoverTrendingGaps({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  className,
}: DiscoverTrendingGapsProps) {
  const { feed, loading, error, refresh } = useDiscoverRadarFeed();

  const filtered = useMemo(() => {
    const gaps = feed?.gaps ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return gaps;
    return gaps.filter(
      (g) =>
        g.headline.toLowerCase().includes(q) ||
        g.domain.includes(q) ||
        g.why.toLowerCase().includes(q),
    );
  }, [feed?.gaps, query]);

  return (
    <section id="trending" className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-resolve-calm-periwinkle" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-calm-periwinkle">
              Trending value gaps
            </p>
            <p className="text-xs text-resolve-muted">
              Ledger authorizations, funded programs, and live GitHub scans — estimates labeled
              {feed?.realSignalCount != null && (
                <span className="text-resolve-muted-dim"> · {feed.realSignalCount} verified signals</span>
              )}
            </p>
          </div>
        </div>
        <DiscoverSectionRefresh
          sectionId="trending-gaps"
          onRefresh={refresh}
          lastUpdated={feed?.updatedAt}
        />
      </div>

      {feed?.degraded && !error && (
        <DiscoverDegradedHint onRefresh={() => void refresh()} className="mb-3" />
      )}

      {loading && !feed ? (
        <DiscoverTrendingSkeleton />
      ) : error && !filtered.length ? (
        <DiscoverStatePanel variant="error">
          <p className="text-sm text-resolve-muted">{error}</p>
          <DiscoverRetryButton onClick={() => void refresh()} />
        </DiscoverStatePanel>
      ) : !filtered.length ? (
        <DiscoverStatePanel variant="empty">
          <p className="text-sm text-resolve-muted">
            No verified value gaps yet. Connect a GitHub or music sensor to populate trending.
          </p>
          <a
            href="#communities"
            className="mt-3 inline-block text-xs font-medium text-resolve-calm-blue hover:text-resolve-accent"
          >
            Connect sensors →
          </a>
        </DiscoverStatePanel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((gap, i) => (
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
      )}
    </section>
  );
}
