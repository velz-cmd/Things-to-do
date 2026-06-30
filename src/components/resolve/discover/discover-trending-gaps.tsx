"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import type { TrendingValueGap } from "@/lib/discover/types";

type DiscoverTrendingGapsProps = {
  signedIn: boolean;
  query?: string;
  className?: string;
};

export function DiscoverTrendingGaps({ signedIn, query = "", className }: DiscoverTrendingGapsProps) {
  const [gaps, setGaps] = useState<TrendingValueGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/discover/trending?limit=12")
      .then((r) => r.json())
      .then((d) => setGaps(d.gaps ?? []))
      .catch(() => setGaps([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = gaps.filter((g) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      g.headline.toLowerCase().includes(q) ||
      g.domain.includes(q) ||
      g.why.toLowerCase().includes(q)
    );
  });

  return (
    <section id="trending" className={className}>
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-amber-300" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            Trending value gaps
          </p>
          <p className="text-xs text-resolve-muted">
            Where money is missing right now — each card has proof and actions
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-resolve-muted">Ranking gaps across OSS, music, research, DAOs…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-resolve-muted">No trending gaps match your filter.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.slice(0, 8).map((gap, i) => (
            <DiscoverActionCard key={gap.id} gap={gap} signedIn={signedIn} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
