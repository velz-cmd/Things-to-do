"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Layers, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listBrowsableCommunities, type CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { CommunityOperateCard } from "@/components/resolve/communities/community-operate-card";
import { CommunityHubSkeleton } from "@/components/resolve/communities/communities-skeletons";
import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { displayVitals } from "@/lib/communities/humanize-vitals";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useCommunitiesHubQuery, prefetchCommunitySurface } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";

type CommunitySummary = {
  slug: string;
  name: string;
  tagline: string;
  kind: string;
  installed: boolean;
  vitals?: CommunityVitalsSummary;
  hubOps?: CommunityHubOpsStats | null;
};

const KINDS = ["all", "music", "oss", "research", "protocol"] as const;

/** Communities hub — daily ops console cards; browse collapsed when operating. */
export function CommunitiesHub() {
  const queryClient = useQueryClient();
  const { state: connections } = useUserConnections();
  const { data: hubData, isLoading: loading } = useCommunitiesHubQuery();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [browseOpen, setBrowseOpen] = useState(false);

  const communities = useMemo(
    () => (hubData?.communities ?? []) as CommunitySummary[],
    [hubData?.communities],
  );

  const sensorStatuses = useMemo(
    () => (hubData?.sensorStatuses ?? []) as CommunitySensorStatus[],
    [hubData?.sensorStatuses],
  );

  const installedBySlug = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of communities) {
      map[c.slug] = c.installed || communityLinkedViaProfile(c.slug, connections);
    }
    for (const meta of COMMUNITY_CATALOG) {
      if (communityLinkedViaProfile(meta.slug, connections)) {
        map[meta.slug] = true;
      }
    }
    return map;
  }, [communities, connections]);

  const operating = useMemo(
    () =>
      COMMUNITY_CATALOG.filter((c) => installedBySlug[c.slug]).map((meta) => ({
        meta,
        summary: communities.find((s) => s.slug === meta.slug),
        linkedOnly: !communities.find((s) => s.slug === meta.slug)?.installed,
      })),
    [communities, installedBySlug],
  );

  const browse = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catalog = listBrowsableCommunities(sensorStatuses);
    return catalog.filter((c) => {
      if (installedBySlug[c.slug]) return false;
      if (kind !== "all" && c.kind !== kind) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
      );
    });
  }, [query, kind, sensorStatuses, installedBySlug]);

  const gatedCount = sensorStatuses.filter((s) => s.sensorGated && !s.sensorLive).length;
  const showBrowseExpanded = browseOpen || operating.length === 0;

  function vitalsFor(slug: string): CommunityVitalsSummary | null {
    const raw = communities.find((s) => s.slug === slug)?.vitals;
    return raw ? displayVitals(raw) : null;
  }

  function prefetchSlug(slug: string) {
    prefetchCommunitySurface(queryClient, slug);
  }

  return (
    <ProductPage
      icon={Layers}
      title="Communities"
      description="Operate programs, payouts, and proof — sources connect once in Profile."
      width="wide"
      accent="emerald"
      actions={
        <button
          type="button"
          onClick={() => setBrowseOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add community
        </button>
      }
      workflows={[
        { label: "Discover", href: "/discover" },
        { label: "Operate", active: true },
        { label: "Mission", href: "/mission" },
        { label: "Capital", href: "/capital" },
      ]}
    >
      <section className="mb-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Your communities</h2>
            <p className="mt-1 max-w-xl text-sm text-resolve-muted">
              Treasury, pending payouts, and programs — one tap to operate.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
          >
            Manage connections
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {operating.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {operating.map(({ meta, summary, linkedOnly }) => (
              <div
                key={meta.slug}
                onMouseEnter={() => prefetchSlug(meta.slug)}
                onFocus={() => prefetchSlug(meta.slug)}
              >
                <CommunityOperateCard
                  community={meta}
                  hubOps={summary?.hubOps ?? null}
                  linkedOnly={linkedOnly}
                  programCountFallback={summary?.vitals?.programCount ?? 0}
                  pendingFallbackUsd={0}
                  treasuryFallbackUsd={summary?.vitals?.fundingTotalUsd ?? 0}
                />
              </div>
            ))}
          </div>
        ) : loading ? (
          <CommunityHubSkeleton count={3} />
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0f18]/40 px-4 py-5">
            <p className="text-sm text-resolve-muted">
              Connect GitHub, Jellyfin, or music in{" "}
              <Link href="/profile" className="text-resolve-accent hover:underline">
                Profile
              </Link>{" "}
              — communities attach automatically. Or browse below to install one.
            </p>
          </div>
        )}
      </section>

      {browse.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setBrowseOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">Add a community</h2>
              <p className="mt-1 text-sm text-resolve-muted">
                {operating.length > 0
                  ? "Browse worlds not linked yet — collapsed until you expand."
                  : "Install a world — connect the matching source in Profile first."}
              </p>
            </div>
            <ChevronDown
              className={clsx(
                "h-5 w-5 shrink-0 text-resolve-muted transition",
                showBrowseExpanded && "rotate-180",
              )}
            />
          </button>

          {gatedCount > 0 && showBrowseExpanded && (
            <p className="mt-2 text-xs text-resolve-muted-dim">
              {gatedCount} catalog {gatedCount > 1 ? "entries" : "entry"} hidden until proof is live.
            </p>
          )}

          {showBrowseExpanded && (
            <>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search music, OSS, research…"
                    className="w-full rounded-xl border border-resolve-border bg-resolve-bg-deep/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={clsx(
                        "rounded-full border px-3 py-1 text-[11px] transition",
                        kind === k
                          ? "border-resolve-accent/40 bg-resolve-accent/10 text-resolve-accent"
                          : "border-resolve-border/60 text-resolve-muted hover:text-white",
                      )}
                    >
                      {k === "all" ? "All" : k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {browse.map((c) => (
                  <InstallResolveCard
                    key={c.slug}
                    community={c}
                    installed={false}
                    vitals={vitalsFor(c.slug)}
                    onInstalled={() => {
                      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
                    }}
                  />
                ))}
              </div>

              {browse.length === 0 && query && (
                <p className="mt-6 text-sm text-resolve-muted">No communities match your search.</p>
              )}
            </>
          )}
        </section>
      )}
    </ProductPage>
  );
}
