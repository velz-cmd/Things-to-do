"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { GitBranch, Mic2, Users } from "lucide-react";
import { DiscoverActionCard } from "@/components/resolve/discover/discover-action-card";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import type { DiscoverIntent, DomainRadarBundle, RadarEmptyState } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { filterActionsByRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { defaultRadarForRole, radarSubtitleForRole } from "@/lib/discover/board-actions-for-role";
import { gapMatchesRadar } from "@/lib/discover/gap-rules";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";

const RADAR_ICONS = {
  oss: GitBranch,
  music: Mic2,
  dao: Users,
} as const;

const RADAR_TABS = [
  { id: "oss" as const, label: "Open source" },
  { id: "music" as const, label: "Creators" },
  { id: "dao" as const, label: "DAO / research" },
];

type DiscoverDomainRadarsProps = {
  signedIn: boolean;
  query?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  needType?: DiscoverNeedTypeFilter;
  className?: string;
};

export function DiscoverDomainRadars({
  signedIn,
  query = "",
  intent = "all",
  role = "all",
  needType = "all",
  className,
}: DiscoverDomainRadarsProps) {
  const { feed, loading, refresh } = useDiscoverRadarFeed();
  const [activeRadar, setActiveRadar] = useState<"oss" | "music" | "dao">(() =>
    defaultRadarForRole(role),
  );
  const feedLoading = loading && !feed;
  const q = query.trim().toLowerCase();

  useEffect(() => {
    setActiveRadar(defaultRadarForRole(role));
  }, [role]);

  const feedGapsForRadar = useMemo(() => {
    const gaps = feed?.gaps ?? [];
    return gaps.filter((g) => {
      if (!gapMatchesRadar(g, activeRadar)) return false;
      if (needType !== "all" && g.needType !== needType) return false;
      if (!q) return true;
      return g.headline.toLowerCase().includes(q) || g.why.toLowerCase().includes(q);
    });
  }, [feed?.gaps, activeRadar, needType, q]);

  const bundles = useMemo(() => {
    const dr = feed?.domainRadars;
    if (!dr) return null;
    return (["oss", "music", "dao"] as const).map((id) => {
      const bundle = dr[id];
      const cards = bundle.cards.filter((g) => {
        if (needType !== "all" && g.needType !== needType) return false;
        if (!q) return true;
        return g.headline.toLowerCase().includes(q) || g.why.toLowerCase().includes(q);
      });
      return { ...bundle, cards };
    });
  }, [feed?.domainRadars, q, needType]);

  const bundle = bundles?.find((b) => b.id === activeRadar);
  const Icon = RADAR_ICONS[activeRadar];

  return (
    <DiscoverPremiumSection
      title="Opportunity radars"
      subtitle={radarSubtitleForRole(role)}
      className={className}
      actions={
        <DiscoverSectionRefresh
          sectionId="domain-radars"
          onRefresh={refresh}
          lastUpdated={feed?.updatedAt}
        />
      }
    >
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-1">
        {RADAR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveRadar(tab.id)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-[11px] font-medium transition",
              activeRadar === tab.id
                ? "bg-resolve-accent/20 text-white ring-1 ring-resolve-accent/25"
                : "text-resolve-muted hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DomainRadarPanel
        radarId={activeRadar}
        bundle={bundle}
        feedGaps={feedGapsForRadar}
        loading={feedLoading}
        signedIn={signedIn}
        intent={intent}
        role={role}
        icon={Icon}
      />
    </DiscoverPremiumSection>
  );
}

function DomainRadarPanel({
  radarId,
  bundle,
  feedGaps,
  loading,
  signedIn,
  intent,
  role,
  icon: Icon,
}: {
  radarId: "oss" | "music" | "dao";
  bundle?: DomainRadarBundle & { cards: DomainRadarBundle["cards"] };
  feedGaps: DomainRadarBundle["cards"];
  loading: boolean;
  signedIn: boolean;
  intent: DiscoverIntent;
  role: DiscoverRole;
  icon: typeof GitBranch;
}) {
  const title = bundle?.title ?? radarId;
  const tagline = bundle?.tagline ?? "";
  const toolbar = filterActionsByRole(bundle?.toolbar ?? [], role);
  const radarCards = bundle?.cards ?? [];
  const displayCards = radarCards.length > 0 ? radarCards : feedGaps;
  const empty = bundle?.emptyState;
  const live = bundle?.hasLiveData ?? false;

  return (
    <div
      id={`radar-${radarId}`}
      className="scroll-mt-24 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-resolve-accent" />
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-resolve-muted-dim">{tagline}</p>
          </div>
        </div>
        {live ? (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-300">
            Live
          </span>
        ) : displayCards.length > 0 ? (
          <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-200/90">
            {displayCards.length} gap{displayCards.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {toolbar.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {toolbar.map((action) => (
            <DiscoverActionChip
              key={action.id}
              action={action}
              signedIn={signedIn}
              surface={`radar-toolbar-${radarId}`}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-resolve-muted">Loading verified radar…</p>
      ) : displayCards.length > 0 ? (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {displayCards.slice(0, 6).map((gap) => (
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
      ) : empty ? (
        <RadarEmpty empty={empty} role={role} />
      ) : (
        <p className="text-xs text-resolve-muted">No cards match your filters.</p>
      )}
    </div>
  );
}

function RadarEmpty({
  empty,
  role,
}: {
  empty: RadarEmptyState;
  role: DiscoverRole;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-resolve-muted">{empty.message}</p>
      {role === "community" ? (
        <Link
          href="/capital"
          className={clsx(
            "inline-flex rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1.5",
            "text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15",
          )}
        >
          View earnings on Capital →
        </Link>
      ) : (
        <Link
          href={empty.actionHref}
          className={clsx(
            "inline-flex rounded-lg border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1.5",
            "text-[11px] font-medium text-resolve-accent hover:bg-resolve-accent/15",
          )}
        >
          {empty.actionLabel} →
        </Link>
      )}
    </div>
  );
}
