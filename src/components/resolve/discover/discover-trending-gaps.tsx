"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import { DiscoverTrendingSkeleton } from "@/components/resolve/discover/discover-skeletons";
import type { DiscoverIntent } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

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
          <TrendingUp className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
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

      {loading && !feed ? (
        <DiscoverTrendingSkeleton />
      ) : error && !filtered.length ? (
        <div className="rounded-xl border border-dashed border-rose-500/30 bg-rose-500/[0.04] px-5 py-8 text-center">
          <p className="text-sm text-resolve-muted">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 text-xs font-medium text-resolve-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-8 text-center">
          <p className="text-sm text-resolve-muted">
            No verified value gaps yet. Connect a GitHub or music sensor to populate trending.
          </p>
          <a
            href="#communities"
            className="mt-3 inline-block text-xs font-medium text-resolve-accent hover:underline"
          >
            Connect sensors →
          </a>
        </div>
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
