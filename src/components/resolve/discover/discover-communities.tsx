"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listBrowsableCommunities, type CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { DiscoverActionChip } from "@/components/resolve/discover/discover-action-card";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import { communityStripActions } from "@/lib/discover/community-strip-actions";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

type CommunitySummary = {
  slug: string;
  installed: boolean;
  vitals?: CommunityVitalsSummary;
};

const KINDS = ["all", "music", "media", "oss", "research", "education", "protocol"] as const;

const DOMAIN_FILTERS: { label: string; kind: (typeof KINDS)[number] }[] = [
  { label: "All", kind: "all" },
  { label: "Music", kind: "music" },
  { label: "Video", kind: "media" },
  { label: "OSS", kind: "oss" },
  { label: "Writers", kind: "education" },
  { label: "Research", kind: "research" },
];

type DiscoverCommunitiesProps = {
  kindFilter?: (typeof KINDS)[number];
  onKindFilterChange?: (kind: (typeof KINDS)[number]) => void;
  signedIn?: boolean;
  role?: DiscoverRole;
};

/** Discover bottom strip — install + quick actions without duplicating the Communities hub. */
export function DiscoverCommunities({
  kindFilter,
  onKindFilterChange,
  signedIn = false,
  role: _role = "all",
}: DiscoverCommunitiesProps = {}) {
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [vitalsBySlug, setVitalsBySlug] = useState<Record<string, CommunityVitalsSummary>>({});
  const [sensorStatuses, setSensorStatuses] = useState<CommunitySensorStatus[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [internalKind, setInternalKind] = useState<(typeof KINDS)[number]>("all");
  const kind = kindFilter ?? internalKind;

  function setKind(next: (typeof KINDS)[number]) {
    if (onKindFilterChange) onKindFilterChange(next);
    else setInternalKind(next);
  }

  const loadCommunities = useCallback(() => {
    setLoadError(null);
    return Promise.all([
      fetch("/api/communities", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("communities")),
      ),
      fetch("/api/communities/sensor-status").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("sensor-status")),
      ),
    ])
      .then(([commRes, statusRes]) => {
        const map: Record<string, boolean> = {};
        const vitals: Record<string, CommunityVitalsSummary> = {};
        for (const c of commRes.communities ?? []) {
          map[c.slug] = c.installed;
          if (c.vitals) vitals[c.slug] = c.vitals;
        }
        setInstalled(map);
        setVitalsBySlug(vitals);
        setSensorStatuses(commRes.sensorStatuses ?? statusRes.statuses ?? []);
        setLastLoaded(new Date().toISOString());
      })
      .catch(() => setLoadError("Could not load community install status"));
  }, []);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catalog = listBrowsableCommunities(sensorStatuses);
    return catalog.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
      );
    });
  }, [query, kind, sensorStatuses]);

  return (
    <DiscoverPremiumSection
      id="communities"
      title="Explore communities"
      subtitle="Music, video, OSS, and research — install once and RESOLVE handles sync in the background"
      className="mb-12"
      actions={
        <DiscoverSectionRefresh
          sectionId="communities-strip"
          onRefresh={loadCommunities}
          lastUpdated={lastLoaded}
        />
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter music, OSS, research…"
            className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(onKindFilterChange ? DOMAIN_FILTERS : KINDS).map((k) => {
            const value = typeof k === "string" ? k : k.kind;
            const label = typeof k === "string" ? (k === "all" ? "All" : k) : k.label;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={
                  kind === value
                    ? "rounded-full border border-resolve-accent/40 bg-resolve-accent/10 px-3 py-1 text-[11px] text-resolve-accent"
                    : "rounded-full border border-resolve-border/60 px-3 py-1 text-[11px] text-resolve-muted hover:text-white"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="mt-4 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/[0.04] px-5 py-4 text-center">
          <p className="text-sm text-resolve-muted">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 text-xs font-medium text-resolve-accent hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filtered.map((c) => {
          const isInstalled = Boolean(installed[c.slug]);
          const actions = communityStripActions({ slug: c.slug, installed: isInstalled });
          return (
            <div key={c.slug} className="space-y-2">
              <InstallResolveCard
                community={c}
                installed={isInstalled}
                vitals={vitalsBySlug[c.slug] ?? null}
                onInstalled={() => setInstalled((prev) => ({ ...prev, [c.slug]: true }))}
              />
              <div className="flex flex-wrap gap-1.5 px-1">
                {actions.map((action) => (
                  <DiscoverActionChip
                    key={action.id}
                    action={action}
                    signedIn={signedIn}
                    surface={`community-strip-${c.slug}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-resolve-muted">No communities match your filter.</p>
      )}
    </DiscoverPremiumSection>
  );
}
