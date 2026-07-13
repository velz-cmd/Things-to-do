"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { CommunityIntentBanner } from "@/components/resolve/communities/community-intent-banner";
import { CommunityConsole } from "@/components/resolve/communities/community-console";
import { CommunityAdvancedPanel } from "@/components/resolve/communities/community-advanced-panel";
import {
  CommunityConfirmSheet,
  type CommunityConfirmRequest,
} from "@/components/resolve/communities/community-confirm-sheet";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useCommunitiesHubQuery, useCommunitySurfaceQuery } from "@/lib/query/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { loadPersistedDiscoverRole } from "@/lib/discover/discover-role-persist";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { getCommunityBySlug, PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import { ACTION_ERRORS } from "@/lib/copy/action-errors";
import {
  COMMUNITY_INTENT_ANCHOR,
  type CommunityIntent,
} from "@/lib/communities/community-nav";
import { defaultProgramTemplateForCommunity } from "@/lib/discover/community-strip-actions";
import { apiCreateProgram } from "@/lib/discover/discover-action-engine";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import styles from "./communities.module.css";

type CachedCommunitySummary = {
  slug: string;
  installed?: boolean;
  vitals?: {
    fundingTotalUsd?: number;
    programCount?: number;
  };
  hubOps?: {
    treasuryUsd?: number;
    pendingObligationsUsd?: number;
    programCount?: number;
    builderCount?: number;
  } | null;
};

type CommunitiesCache = { communities?: CachedCommunitySummary[] };

function numeric(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function CommunityHome({ slug }: { slug: string }) {
  const catalog = getCommunityBySlug(slug);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pageIntent = searchParams.get("intent");
  const tab = searchParams.get("tab") === "advanced" ? "advanced" : "console";

  const consoleSurfaceQuery = useCommunitySurfaceQuery(slug, {
    lite: true,
    pollWhenInstalled: tab === "console",
    enabled: tab === "console",
  });
  const advancedSurfaceQuery = useCommunitySurfaceQuery(slug, {
    lite: false,
    pollWhenInstalled: false,
    enabled: tab === "advanced",
  });
  const communitiesHubQuery = useCommunitiesHubQuery();

  const surface =
    tab === "advanced" ? advancedSurfaceQuery.data : consoleSurfaceQuery.data;
  const loading =
    tab === "advanced" ? advancedSurfaceQuery.isLoading : consoleSurfaceQuery.isLoading;
  const loadFailed =
    !surface && (tab === "advanced" ? advancedSurfaceQuery.isError : consoleSurfaceQuery.isError);

  const refetch = useCallback(async () => {
    if (tab === "advanced") {
      await advancedSurfaceQuery.refetch();
    } else {
      await consoleSurfaceQuery.refetch();
    }
  }, [tab, advancedSurfaceQuery, consoleSurfaceQuery]);

  const [discoverRole, setDiscoverRole] = useState<DiscoverRole | null>(null);
  const { state: connections } = useUserConnections();
  const [obligationsFilter, setObligationsFilter] = useState<"all" | "pending">("all");
  const [confirm, setConfirm] = useState<CommunityConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const cachedHub =
    (communitiesHubQuery.data as CommunitiesCache | undefined) ??
    queryClient.getQueryData<CommunitiesCache>(queryKeys.communities);
  const cachedSummary = cachedHub?.communities?.find((community) => community.slug === slug);
  const profileLinked = communityLinkedViaProfile(slug, connections);
  const intentBypass = ["approve_payouts", "review_obligations", "fund", "create_program"].includes(
    pageIntent ?? "",
  );
  const dbInstalled = Boolean(cachedSummary?.installed) || Boolean(surface?.installed);
  const installed = dbInstalled || intentBypass || profileLinked;

  const cachedSurface = useMemo<CommunitySurface | null>(() => {
    if (!catalog || surface || tab === "advanced") return null;
    if (!cachedSummary?.installed && !intentBypass && !profileLinked) return null;

    const treasuryUsd = numeric(cachedSummary?.hubOps?.treasuryUsd ?? cachedSummary?.vitals?.fundingTotalUsd);
    const pendingUsd = numeric(cachedSummary?.hubOps?.pendingObligationsUsd);
    const builderCount = numeric(cachedSummary?.hubOps?.builderCount);
    const programBudgetUsd = numeric(cachedSummary?.vitals?.fundingTotalUsd ?? treasuryUsd);
    const now = new Date().toISOString();

    return {
      slug,
      name: catalog.name,
      tagline: catalog.tagline,
      kind: catalog.kind,
      upstream: catalog.upstream,
      doctrine: catalog.doctrine,
      connectors: catalog.connectors,
      accent: catalog.accent,
      installed: dbInstalled || intentBypass || profileLinked,
      install: null,
      programs: [],
      health: {
        treasuryUsd,
        obligationsUsd: pendingUsd,
        communityObligationsUsd: pendingUsd,
        connectorStatus: catalog.connectors.map((id) => ({
          id,
          label: id,
          health: "syncing",
        })),
        scrobbleBridge: false,
        lastScrobbleAt: null,
      },
      impact: {
        treasuryUsd,
        programBudgetUsd,
        communityObligationsUsd: pendingUsd,
        authorizedUsd: pendingUsd,
        settledUsd: 0,
        platformFeeUsd: 0,
        playCount: 0,
        artistCount: builderCount,
        estimatedReach: builderCount,
        stages: [],
      },
      observatory: [],
      economicMemory: [],
      authorizations: [],
      timeline: [
        {
          id: `cached-${slug}`,
          eventType: "syncing",
          title: "Loading community metrics",
          detail: "Cached operating totals are visible while program and obligation rows load.",
          createdAt: now,
        },
      ],
      deployReadiness: {
        canDeploy: false,
        authorizedCount: builderCount,
        authorizedUsd: pendingUsd,
        pendingObligationsUsd: pendingUsd,
        fundingGapUsd: pendingUsd,
        walletMappedCount: 0,
        reasons: pendingUsd > 0 ? ["Obligation payee rows are still loading."] : [],
      },
    };
  }, [cachedSummary, catalog, dbInstalled, intentBypass, profileLinked, slug, surface, tab]);

  const activeSurface = surface ?? cachedSurface;
  const installedSlugsKey = connections.installedCommunitySlugs.join(",");

  useEffect(() => {
    setDiscoverRole(loadPersistedDiscoverRole());
  }, []);

  useEffect(() => {
    if (!connections.signedIn) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    void communitiesHubQuery.refetch();
    if (dbInstalled || intentBypass || profileLinked) {
      void refetch();
    }
  }, [
    connections.githubUsername,
    connections.hasAnyConnector,
    installedSlugsKey,
    connections.signedIn,
    dbInstalled,
    intentBypass,
    profileLinked,
    queryClient,
    communitiesHubQuery,
    refetch,
  ]);

  useEffect(() => {
    if (pageIntent === "review_obligations" || pageIntent === "approve_payouts") {
      setObligationsFilter("pending");
    }
  }, [pageIntent]);

  useEffect(() => {
    if (!pageIntent || (loading && !activeSurface)) return;
    const anchor = COMMUNITY_INTENT_ANCHOR[pageIntent as CommunityIntent];
    if (!anchor) return;
    const timer = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pageIntent, loading, activeSurface]);

  const refresh = useCallback(async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: queryKeys.communities });
  }, [refetch, queryClient]);

  const insertProgramIntoCache = useCallback(
    (program: ProgramRecord) => {
      (["lite", "full"] as const).forEach((mode) => {
        queryClient.setQueryData<CommunitySurface | undefined>(
          queryKeys.communitySurface(slug, mode),
          (current) => {
            if (!current) return current;
            if (current.programs.some((p) => p.id === program.id)) return current;
            return {
              ...current,
              installed: true,
              programs: [...current.programs, program],
              deployReadiness: current.deployReadiness ?? {
                canDeploy: false,
                authorizedCount: 0,
                authorizedUsd: 0,
                pendingObligationsUsd: 0,
                fundingGapUsd: 0,
                walletMappedCount: 0,
                reasons: [],
              },
            };
          },
        );
      });
    },
    [queryClient, slug],
  );

  function openCreateConfirm() {
    const templateId = defaultProgramTemplateForCommunity(slug);
    const template = PROGRAM_TEMPLATES[templateId as keyof typeof PROGRAM_TEMPLATES];
    setConfirm({
      kind: "create_program",
      title: "Create payout program",
      detail:
        template?.description ??
        "Creates a draft payout rule and saves it to this community account.",
      communityName: catalog?.name ?? slug,
      templateLabel: template?.name ?? templateId,
    });
  }

  async function handleConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);

    try {
      if (confirm.kind === "create_program") {
        const templateId = defaultProgramTemplateForCommunity(slug);
        try {
          const created = await apiCreateProgram(slug, templateId);
          if (!created.program) throw new Error("Program was not created");
          insertProgramIntoCache(created.program);
          toast.success(`${created.program.name} created as draft`, {
            description: "Review the policy and synchronize evidence before settlement preparation.",
          });
          setConfirm(null);
          void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
          void refetch();
          window.setTimeout(() => {
            document.getElementById(`program-${created.program?.id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 50);
        } catch (err) {
          toast.error("Program was not created", {
            description: err instanceof Error ? err.message : "Unknown API error",
          });
        }
        return;
      }

    } finally {
      setConfirmBusy(false);
    }
  }

  if (!catalog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-resolve-muted">Community not found</p>
      </div>
    );
  }

  const surfaceLoading = loading && !surface;

  return (
    <main className={styles.workspace}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.pageFrame}>
      {(tab === "advanced" || !installed || (loadFailed && !activeSurface)) && (
        <header className={styles.detailContextHeader}>
          <div>
            <Link href="/communities" className={styles.backLink}><ArrowLeft /> Communities</Link>
            <h1>{catalog.name}</h1>
            <p>{catalog.tagline}</p>
          </div>
          {!installed ? <InstallResolveCard community={catalog} installed={false} compact /> : <span className={styles.connectedLabel}><CheckCircle2 /> RESOLVE connected</span>}
        </header>
      )}
      <CommunityIntentBanner
        intent={pageIntent}
        role={discoverRole}
        catalog={catalog}
        installed={installed}
      />

      {loadFailed && !activeSurface ? (
        <div className="max-w-lg rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
          <p className="text-sm font-medium text-amber-100">Community console is taking too long.</p>
          <p className="mt-1 text-sm text-resolve-muted">
            We stopped waiting so the page does not hang. Retry now, or continue from Discover while
            the community data catches up.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-300/15"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry console
            </button>
            <Link
              href="/discover"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Open Discover
            </Link>
          </div>
        </div>
      ) : !installed ? (
        <div className="max-w-lg space-y-6">
          {surfaceLoading && (
            <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
              Checking live install state in the background. You can connect this community now.
            </p>
          )}
          <InstallResolveCard community={catalog} onInstalled={() => void refresh()} />
          <CommunitySensorPanel slug={slug} installed={false} />
          <p className="text-xs text-resolve-muted">
            After install,{" "}
            <Link
              href={`/communities/${slug}?intent=install`}
              className="text-resolve-accent hover:underline"
            >
              open the console
            </Link>{" "}
            to create programs and operate payouts.
          </p>
        </div>
      ) : !activeSurface ? (
        <div className="max-w-lg rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-white">Opening community console...</p>
          <p className="mt-1 text-sm text-resolve-muted">
            Live metrics are loading. Retry if this takes more than a moment.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry metrics
          </button>
        </div>
      ) : tab === "advanced" ? (
        <CommunityAdvancedPanel slug={slug} surface={activeSurface} onRefresh={() => void refresh()} />
      ) : (
        <div className="space-y-4">
          {surfaceLoading && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
              Console opened from cached state. {ACTION_ERRORS.metricsCachedBanner}
            </div>
          )}
          <CommunityConsole
            slug={slug}
            catalog={catalog}
            surface={activeSurface}
            connections={connections}
            busy={confirmBusy}
            obligationsFilter={obligationsFilter}
            onObligationsFilterChange={setObligationsFilter}
            onRequestCreateProgram={openCreateConfirm}
            onRefresh={() => void refresh()}
            initialTab={
              pageIntent === "create_program" || pageIntent === "fund"
                ? "programs"
                : pageIntent === "review_obligations" || pageIntent === "approve_payouts"
                  ? "obligations"
                  : "overview"
            }
          />
        </div>
      )}

      <CommunityConfirmSheet
        open={Boolean(confirm)}
        request={confirm}
        busy={confirmBusy}
        onClose={() => {
          setConfirm(null);
        }}
        onConfirm={() => void handleConfirm()}
      />
      </div>
    </main>
  );
}
