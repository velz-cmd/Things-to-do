"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { GitBranch, Mic2, Users } from "lucide-react";
import { useDiscoverRadarFeed } from "@/components/resolve/discover/discover-radar-feed-provider";
import type { DiscoverIntent, DomainRadarBundle } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import { defaultRadarForRole } from "@/lib/discover/board-actions-for-role";
import { gapMatchesRadar } from "@/lib/discover/gap-rules";
import { dedupeTrendingGaps } from "@/lib/discover/gap-dedupe";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import { DiscoverAttachRail } from "@/components/resolve/discover/discover-attach-rail";
import { DiscoverFeatureRow } from "@/components/resolve/discover/discover-feature-row";
import { collectRadarRows, RADAR_MAX_ROWS } from "@/lib/discover/discover-row-limits";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import type { DiscoverWorkspaceLane } from "@/components/resolve/discover/discover-workspace-nav";
import { LANE_PURPOSE, WORKSPACE_LANE_LABELS } from "@/lib/discover/discover-lane-copy";
import styles from "./discover-workspace.module.css";

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
  onSwitchLane?: (lane: DiscoverWorkspaceLane) => void;
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
  const { state: connections } = useUserConnections();
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
  const radarCards = bundle?.cards ?? [];
  const displayRows = collectRadarRows(
    activeRadar,
    radarCards,
    feedGapsForRadar,
    role,
    connections,
  );
  const live = bundle?.hasLiveData ?? false;

  return (
    <DiscoverPremiumSection
      title={WORKSPACE_LANE_LABELS.radars}
      subtitle={live ? `Ledger-backed · ${LANE_PURPOSE.radars}` : LANE_PURPOSE.radars}
      className={className}
      actions={
        <DiscoverSectionRefresh
          sectionId="domain-radars"
          onRefresh={refresh}
          lastUpdated={feed?.updatedAt}
        />
      }
    >
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-black/15 p-1" role="tablist" aria-label="Live signal domains">
        {RADAR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeRadar === tab.id}
            onClick={() => setActiveRadar(tab.id)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-[11px] font-medium transition",
              activeRadar === tab.id
                ? "bg-resolve-accent/20 text-white ring-1 ring-resolve-accent/25"
                : "text-resolve-muted hover:text-white",
            )}
          >
            {tab.label}
            <span className="ml-1 text-[9px] text-resolve-muted-dim">({RADAR_MAX_ROWS[tab.id]})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {displayRows.length === 0 && (
          <DiscoverAttachRail
            context="radar"
            radarId={activeRadar}
            role={role}
            needType={needType}
            signedIn={signedIn}
          />
        )}

        <div
          id={`radar-${activeRadar}`}
          className="min-w-0 flex-1 scroll-mt-24"
        >
          <div className="mb-2 flex items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-resolve-accent" />
              <div>
                <h3 className="text-sm font-semibold text-white">{bundle?.title ?? activeRadar}</h3>
              </div>
            </div>
            {live ? (
              <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/[0.07] px-2 py-0.5 text-[9px] text-cyan-200">
                <span className={styles.signalLiveDot} aria-hidden="true" />Live evidence
              </span>
            ) : displayRows.length > 0 ? (
              <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-200/90">
                Awaiting upstream
              </span>
            ) : null}
          </div>

          {feedLoading ? (
            <p className="text-xs text-resolve-muted">Loading verified radar…</p>
          ) : displayRows.length > 0 ? (
            <ul>
              {displayRows.map((gap, i) => (
                <DiscoverFeatureRow
                  key={gap.id}
                  gap={gap}
                  signedIn={signedIn}
                  intent={intent}
                  role={role}
                  rank={i + 1}
                  surface={`radar-${activeRadar}`}
                  lane="radars"
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-resolve-muted">No signals yet for this radar.</p>
          )}
        </div>
      </div>
    </DiscoverPremiumSection>
  );
}
