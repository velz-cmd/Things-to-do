"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { GitBranch, Mic2, Users } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import type { DiscoverIntent, DomainRadarBundle, RadarEmptyState } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

const RADAR_ICONS = {
  oss: GitBranch,
  music: Mic2,
  dao: Users,
} as const;

type DiscoverDomainRadarsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  className?: string;
};

export function DiscoverDomainRadars({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  className,
}: DiscoverDomainRadarsProps) {
  const { feed, loading, refresh } = useDiscoverRadarFeed();
  const feedLoading = loading && !feed;
  const q = query.trim().toLowerCase();

  const bundles = useMemo(() => {
    const dr = feed?.domainRadars;
    if (!dr) return null;
    return (["oss", "music", "dao"] as const).map((id) => {
      const bundle = dr[id];
      const cards = bundle.cards.filter((g) => {
        if (!q) return true;
        return g.headline.toLowerCase().includes(q) || g.why.toLowerCase().includes(q);
      });
      return { ...bundle, cards };
    });
  }, [feed?.domainRadars, q]);

  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
          Opportunity radars
        </p>
        <DiscoverSectionRefresh
          sectionId="domain-radars"
          onRefresh={refresh}
          lastUpdated={feed?.updatedAt}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {(["oss", "music", "dao"] as const).map((radarId) => {
          const bundle = bundles?.find((b) => b.id === radarId);
          const Icon = RADAR_ICONS[radarId];
          return (
            <DomainRadarColumn
              key={radarId}
              radarId={radarId}
              bundle={bundle}
              loading={feedLoading}
              signedIn={signedIn}
              intent={intent}
              role={role}
              icon={Icon}
            />
          );
        })}
      </div>
    </section>
  );
}

function DomainRadarColumn({
  radarId,
  bundle,
  loading,
  signedIn,
  intent,
  role,
  icon: Icon,
}: {
  radarId: "oss" | "music" | "dao";
  bundle?: DomainRadarBundle & { cards: DomainRadarBundle["cards"] };
  loading: boolean;
  signedIn: boolean;
  intent: DiscoverIntent;
  role: DiscoverRole;
  icon: typeof GitBranch;
}) {
  const title = bundle?.title ?? radarId;
  const tagline = bundle?.tagline ?? "";
  const toolbar = bundle?.toolbar ?? [];
  const cards = bundle?.cards ?? [];
  const empty = bundle?.emptyState;
  const live = bundle?.hasLiveData ?? false;

  return (
    <div
      id={`radar-${radarId}`}
      className="scroll-mt-24 rounded-xl border border-resolve-border/60 bg-gradient-to-b from-resolve-bg-deep/30 to-[#060a12]/40 p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-resolve-accent" />
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-resolve-muted-dim">{tagline}</p>
          </div>
        </div>
        {live && (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-300">
            Live
          </span>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Radar actions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {toolbar.map((action) => (
            <DiscoverActionChip
              key={action.id}
              action={action}
              signedIn={signedIn}
              surface={`radar-toolbar-${radarId}`}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-resolve-muted">Loading verified radar…</p>
      ) : !cards.length && empty ? (
        <RadarEmpty empty={empty} />
      ) : !cards.length ? (
        <p className="text-xs text-resolve-muted">No cards match your filter — toolbar actions still work.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((gap) => (
            <DiscoverActionCard
              key={gap.id}
              gap={gap}
              signedIn={signedIn}
              intent={intent}
              role={role}
              compact
              surface={`radar-${radarId}`}
            />
          ))}
        </ul>
      )}
    </div>
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
