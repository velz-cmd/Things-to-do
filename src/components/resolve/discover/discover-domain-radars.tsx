"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { GitBranch, Mic2, Users } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import type { DiscoverIntent, RadarEmptyState } from "@/lib/discover/types";

const RADAR_META: Record<
  "oss" | "music" | "dao",
  { title: string; icon: typeof GitBranch }
> = {
  oss: { title: "Open source radar", icon: GitBranch },
  music: { title: "Creator / artist radar", icon: Mic2 },
  dao: { title: "DAO / community radar", icon: Users },
};

type DiscoverDomainRadarsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  className?: string;
};

export function DiscoverDomainRadars({
  signedIn,
  query = "",
  intent = "all",
  className,
}: DiscoverDomainRadarsProps) {
  const { feed, loading } = useDiscoverRadarFeed();
  const q = query.trim().toLowerCase();

  const byRadar = useMemo(() => {
    const radars = feed?.radars ?? { oss: [], music: [], dao: [] };
    const map = new Map<"oss" | "music" | "dao", typeof radars.oss>();
    for (const key of ["oss", "music", "dao"] as const) {
      const items = radars[key].filter((g) => {
        if (!q) return true;
        return g.headline.toLowerCase().includes(q) || g.why.toLowerCase().includes(q);
      });
      map.set(key, items);
    }
    return map;
  }, [feed?.radars, q]);

  const emptyById = useMemo(() => {
    const m = new Map<string, RadarEmptyState>();
    for (const s of feed?.emptyStates ?? []) m.set(s.id, s);
    return m;
  }, [feed?.emptyStates]);

  return (
    <section className={className}>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
        Domain radars
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        {(["oss", "music", "dao"] as const).map((radarId) => {
          const meta = RADAR_META[radarId];
          const items = byRadar.get(radarId) ?? [];
          const empty = emptyById.get(radarId);
          const Icon = meta.icon;
          return (
            <div
              key={radarId}
              id={`radar-${radarId}`}
              className="scroll-mt-24 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/20 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-resolve-accent" />
                <h3 className="text-sm font-semibold text-white">{meta.title}</h3>
              </div>
              {loading ? (
                <p className="text-xs text-resolve-muted">Loading verified radar…</p>
              ) : !items.length && empty ? (
                <RadarEmpty empty={empty} />
              ) : !items.length ? (
                <p className="text-xs text-resolve-muted">No gaps match your filter.</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((gap) => (
                    <DiscoverActionCard
                      key={gap.id}
                      gap={gap}
                      signedIn={signedIn}
                      intent={intent}
                      compact
                      surface={`radar-${radarId}`}
                    />
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

function RadarEmpty({ empty }: { empty: RadarEmptyState }) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-resolve-muted">{empty.message}</p>
      <Link
        href={empty.actionHref}
        className={clsx(
          "inline-flex rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1.5",
          "text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15",
        )}
      >
        {empty.actionLabel} →
      </Link>
    </div>
  );
}
