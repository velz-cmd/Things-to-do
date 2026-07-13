"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  Grid2X2,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import clsx from "clsx";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listBrowsableCommunities, type CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import {
  CommunityOperateCard,
  getCommunityOperationalState,
  type CommunityOperationalState,
} from "@/components/resolve/communities/community-operate-card";
import { CommunityHubSkeleton } from "@/components/resolve/communities/communities-skeletons";
import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { displayVitals } from "@/lib/communities/humanize-vitals";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useCommunitiesHubQuery, prefetchCommunitySurface } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import styles from "./communities.module.css";

type CommunitySummary = {
  slug: string;
  name: string;
  tagline: string;
  kind: string;
  installed: boolean;
  vitals?: CommunityVitalsSummary;
  hubOps?: CommunityHubOpsStats | null;
};

type FilterId = "all" | CommunityOperationalState;
type ViewMode = "grid" | "list";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "healthy", label: "Healthy" },
  { id: "setup", label: "Needs setup" },
  { id: "review", label: "Needs review" },
  { id: "ready", label: "Settlement ready" },
];

export function CommunitiesHub() {
  const queryClient = useQueryClient();
  const { state: connections } = useUserConnections();
  const { data: hubData, isLoading: loading, refetch, isFetching } = useCommunitiesHubQuery();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [browseOpen, setBrowseOpen] = useState(false);

  const communities = useMemo(
    () => (hubData?.communities ?? []) as CommunitySummary[],
    [hubData?.communities],
  );
  const sensorStatuses = useMemo(
    () => (hubData?.sensorStatuses ?? []) as CommunitySensorStatus[],
    [hubData?.sensorStatuses],
  );
  const degraded = Boolean((hubData as { degraded?: boolean } | undefined)?.degraded);
  const metricsSyncing = Boolean((hubData as { metricsSyncing?: boolean } | undefined)?.metricsSyncing);

  const operativeSlugs = useMemo(() => {
    const set = new Set(communities.filter((community) => community.installed).map((community) => community.slug));
    if (connections.signedIn) {
      COMMUNITY_CATALOG.forEach((community) => {
        if (communityLinkedViaProfile(community.slug, connections)) set.add(community.slug);
      });
    }
    return set;
  }, [communities, connections]);

  const operating = useMemo(
    () =>
      COMMUNITY_CATALOG.filter((community) => operativeSlugs.has(community.slug)).map((meta) => ({
        meta,
        summary: communities.find((community) => community.slug === meta.slug),
      })),
    [communities, operativeSlugs],
  );

  const filteredOperating = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return operating.filter(({ meta, summary }) => {
      const state = getCommunityOperationalState(summary?.hubOps ?? null, summary?.vitals ?? null);
      if (filter !== "all" && state !== filter) return false;
      if (!normalized) return true;
      return [meta.name, meta.tagline, meta.upstream, meta.kind].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [filter, operating, query]);

  const browse = useMemo(
    () => listBrowsableCommunities(sensorStatuses).filter((community) => !operativeSlugs.has(community.slug)),
    [operativeSlugs, sensorStatuses],
  );

  const summary = useMemo(() => {
    let programs = 0;
    let obligations = 0;
    let sourceHealthy = 0;
    let identities = 0;
    let settlementReady = 0;
    operating.forEach(({ summary: row }) => {
      const ops = row?.hubOps;
      programs += ops?.programCount ?? row?.vitals?.programCount ?? 0;
      obligations += ops?.pendingCount ?? 0;
      identities += ops?.builderCount ?? 0;
      if (row?.vitals?.sensor.ready) sourceHealthy += 1;
      if (getCommunityOperationalState(ops ?? null, row?.vitals ?? null) === "ready") settlementReady += 1;
    });
    return { installed: operating.length, programs, obligations, sourceHealthy, identities, settlementReady };
  }, [operating]);

  function vitalsFor(slug: string): CommunityVitalsSummary | null {
    const raw = communities.find((community) => community.slug === slug)?.vitals;
    return raw ? displayVitals(raw) : null;
  }

  return (
    <main className={styles.workspace}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.pageFrame}>
        <header className={styles.portfolioHeader}>
          <div>
            <p className={styles.eyebrow}><span className={styles.liveDot} />Communities</p>
            <h1>Operate the systems behind verified value.</h1>
            <p className={styles.headerCopy}>Connect evidence, resolve identities, configure programs, and prepare obligations for settlement.</p>
          </div>
          <div className={styles.headerActions}>
            <button data-action-id="community.install" type="button" className={styles.primaryButton} onClick={() => setBrowseOpen(true)}>
              <Plus className="h-4 w-4" /> Add community
            </button>
            <Link data-action-id="profile.manage_connections" href="/profile?section=connections&next=%2Fcommunities" className={styles.secondaryButton}>
              Manage connections <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {(degraded || metricsSyncing) && (
          <div className={styles.syncBanner}>
            <span>{degraded ? "Cached operations shown · live sources reconnecting" : "Cached operations shown · live sources syncing"}</span>
            <button type="button" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={clsx("h-3.5 w-3.5", isFetching && "animate-spin")} /> Refresh
            </button>
          </div>
        )}

        <section className={styles.statusRail} aria-label="Community operations summary">
          {[
            ["Installed", summary.installed],
            ["Active programs", summary.programs],
            ["Open obligations", summary.obligations],
            ["Source health", `${summary.sourceHealthy} / ${summary.installed || 0}`],
            ["Attributed identities", summary.identities],
            ["Settlement ready", summary.settlementReady],
          ].map(([label, value]) => (
            <div key={label} className={styles.statusMetric}>
              <span>{label}</span><strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className={styles.controller} aria-label="Community controls">
          <div className={styles.filters}>
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={filter === item.id ? styles.filterActive : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.searchControls}>
            <label className={styles.searchField}>
              <Search className="h-4 w-4" aria-hidden />
              <span className="sr-only">Search communities</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search communities…" />
            </label>
            <div className={styles.viewToggle} aria-label="View mode">
              <button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 /></button>
              <button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List /></button>
            </div>
          </div>
        </section>

        <section aria-labelledby="operating-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.sectionKicker}>Installed ecosystems</p><h2 id="operating-title">Community operations</h2></div>
            <span>{filteredOperating.length} visible</span>
          </div>
          {filteredOperating.length > 0 ? (
            <div className={view === "grid" ? styles.communityGrid : styles.communityList}>
              {filteredOperating.map(({ meta, summary: row }) => (
                <div key={meta.slug} onMouseEnter={() => prefetchCommunitySurface(queryClient, meta.slug)} onFocus={() => prefetchCommunitySurface(queryClient, meta.slug)}>
                  <CommunityOperateCard community={meta} hubOps={row?.hubOps ?? null} vitals={row?.vitals ?? null} compact={view === "list"} />
                </div>
              ))}
            </div>
          ) : loading && !connections.signedIn ? (
            <CommunityHubSkeleton count={3} />
          ) : (
            <div className={styles.emptyState}>
              <p>{operating.length ? "No installed communities match this operational view." : "No ecosystem is installed yet."}</p>
              <button data-action-id="community.install" type="button" onClick={() => setBrowseOpen(true)}>Add a community</button>
            </div>
          )}
        </section>

        {browse.length > 0 && (
          <section className={styles.installSection}>
            <button type="button" className={styles.installToggle} onClick={() => setBrowseOpen((open) => !open)} aria-expanded={browseOpen}>
              <div><p className={styles.sectionKicker}>Installation catalog</p><h2>Connect another ecosystem</h2><span>Sources are connected in Profile and return here with context preserved.</span></div>
              <ChevronDown className={clsx("h-5 w-5", browseOpen && "rotate-180")} />
            </button>
            {browseOpen && (
              <div className={styles.installGrid}>
                {browse.map((community) => (
                  <InstallResolveCard key={community.slug} community={community} installed={false} vitals={vitalsFor(community.slug)} onInstalled={() => void queryClient.invalidateQueries({ queryKey: queryKeys.communities })} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
