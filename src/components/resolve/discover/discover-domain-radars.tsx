"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { GitBranch, Mic2, Users } from "lucide-react";
import type { TrendingValueGap } from "@/lib/discover/types";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";

const RADARS: {
  id: string;
  title: string;
  icon: typeof GitBranch;
  domains: string[];
  empty: string;
}[] = [
  {
    id: "oss",
    title: "Open source radar",
    icon: GitBranch,
    domains: ["oss", "protocol"],
    empty: "No OSS gaps — connect GitHub sensors to populate",
  },
  {
    id: "music",
    title: "Creator / artist radar",
    icon: Mic2,
    domains: ["music"],
    empty: "Connect Navidrome or MusicBrainz to surface artist earnings",
  },
  {
    id: "dao",
    title: "DAO / community radar",
    icon: Users,
    domains: ["dao", "community", "research"],
    empty: "Install a community and launch a grant or QF pool",
  },
];

type DiscoverDomainRadarsProps = {
  signedIn: boolean;
  query?: string;
  className?: string;
};

export function DiscoverDomainRadars({
  signedIn,
  query = "",
  className,
}: DiscoverDomainRadarsProps) {
  const [gaps, setGaps] = useState<TrendingValueGap[]>([]);

  useEffect(() => {
    void fetch("/api/discover/trending?limit=24")
      .then((r) => r.json())
      .then((d) => setGaps(d.gaps ?? []))
      .catch(() => setGaps([]));
  }, []);

  const q = query.trim().toLowerCase();

  const byRadar = useMemo(() => {
    const map = new Map<string, TrendingValueGap[]>();
    for (const radar of RADARS) {
      const items = gaps.filter((g) => {
        if (!radar.domains.includes(g.domain)) return false;
        if (!q) return true;
        return g.headline.toLowerCase().includes(q) || g.why.toLowerCase().includes(q);
      });
      map.set(radar.id, items.slice(0, 4));
    }
    return map;
  }, [gaps, q]);

  return (
    <section className={className}>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
        Domain radars
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        {RADARS.map((radar) => {
          const items = byRadar.get(radar.id) ?? [];
          const Icon = radar.icon;
          return (
            <div
              key={radar.id}
              id={`radar-${radar.id}`}
              className="scroll-mt-24 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/20 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-resolve-accent" />
                <h3 className="text-sm font-semibold text-white">{radar.title}</h3>
              </div>
              {!items.length ? (
                <p className="text-xs text-resolve-muted">{radar.empty}</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((gap) => (
                    <DiscoverActionCard key={gap.id} gap={gap} signedIn={signedIn} compact />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
