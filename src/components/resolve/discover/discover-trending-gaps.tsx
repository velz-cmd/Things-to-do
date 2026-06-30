"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import type { DiscoverIntent } from "@/lib/discover/types";

type DiscoverTrendingGapsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  className?: string;
};

export function DiscoverTrendingGaps({
  signedIn,
  query = "",
  intent = "all",
  className,
}: DiscoverTrendingGapsProps) {
  const { feed, loading } = useDiscoverRadarFeed();

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
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-amber-300" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            Trending value gaps
          </p>
          <p className="text-xs text-resolve-muted">
            Live GitHub scans, ledger authorizations, and funded programs only
            {feed?.realSignalCount != null && (
              <span className="text-resolve-muted-dim"> · {feed.realSignalCount} verified signals</span>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-resolve-muted">Loading verified gaps from sensors and ledger…</p>
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
          {filtered.slice(0, 8).map((gap, i) => (
            <DiscoverActionCard
              key={gap.id}
              gap={gap}
              signedIn={signedIn}
              intent={intent}
              rank={i + 1}
              surface="trending-gaps"
            />
          ))}
        </div>
      )}
    </section>
  );
}
