"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Music2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { CommunityIntentBanner } from "@/components/resolve/communities/community-intent-banner";
import { CommunityConsoleSkeleton } from "@/components/resolve/communities/communities-skeletons";
import { CommunityConsole } from "@/components/resolve/communities/community-console";
import { CommunityAdvancedPanel } from "@/components/resolve/communities/community-advanced-panel";
import {
  CommunityConfirmSheet,
  type CommunityConfirmRequest,
} from "@/components/resolve/communities/community-confirm-sheet";
import {
  CommunityFundSheetHost,
  useCommunityOperationsHandlers,
} from "@/components/resolve/communities/community-operations";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useCommunitySurfaceQuery } from "@/lib/query/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { loadPersistedDiscoverRole } from "@/lib/discover/discover-role-persist";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { getCommunityBySlug, PROGRAM_TEMPLATES } from "@/lib/communities/catalog";
import {
  COMMUNITY_INTENT_ANCHOR,
  type CommunityIntent,
} from "@/lib/communities/community-nav";
import { defaultProgramTemplateForCommunity } from "@/lib/discover/community-strip-actions";
import { apiCreateProgram } from "@/lib/discover/discover-action-engine";
import type { CommunitySurface, ProgramRecord } from "@/lib/communities/types";

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
  const [deploying, setDeploying] = useState<string | null>(null);
  const [obligationsFilter, setObligationsFilter] = useState<"all" | "pending">("all");
  const [confirm, setConfirm] = useState<CommunityConfirmRequest | null>(null);
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const ops = useCommunityOperationsHandlers(slug);

  useEffect(() => {
    setDiscoverRole(loadPersistedDiscoverRole());
  }, []);

  useEffect(() => {
    if (pageIntent === "review_obligations") {
      setObligationsFilter("pending");
    }
  }, [pageIntent]);

  useEffect(() => {
    if (!pageIntent || loading) return;
    const anchor = COMMUNITY_INTENT_ANCHOR[pageIntent as CommunityIntent];
    if (!anchor) return;
    const timer = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pageIntent, loading, surface]);

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

  const primaryProgram = surface?.programs[0];

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

  function openDeployConfirm(programId: string) {
    const program = surface?.programs.find((p) => p.id === programId);
    if (!program || !surface) return;
    const readiness = program.deployReadiness ?? surface.deployReadiness;
    setPendingProgramId(programId);
    setConfirm({
      kind: "deploy",
      title: "Settle on Arc",
      detail:
        "Settles authorized obligations to mapped wallets from your program pool.",
      programName: program.name,
      pendingUsd: readiness?.pendingObligationsUsd ?? 0,
      payeeCount: readiness?.authorizedCount ?? 0,
      canDeploy: readiness?.canDeploy ?? false,
      blockReason: readiness?.reasons?.[0],
    });
  }

  function openApproveConfirm() {
    if (!surface || !primaryProgram) return;
    const readiness = primaryProgram.deployReadiness ?? surface.deployReadiness;
    const fundingGapUsd = readiness?.fundingGapUsd ?? 0;
    const needsFund = fundingGapUsd > 0.01;
    setPendingProgramId(primaryProgram.id);
    setConfirm({
      kind: "approve_payouts",
      title: needsFund ? "Fund payout gap" : "Approve payouts",
      detail: needsFund
        ? `This program has verified obligations, but needs $${fundingGapUsd.toFixed(2)} more funding before settlement.`
        : "Settle the authorized Arc batch and record receipts for payees.",
      programName: primaryProgram.name,
      pendingUsd: readiness?.pendingObligationsUsd ?? 0,
      needsFund,
      fundingGapUsd,
      canDeploy: readiness?.canDeploy ?? false,
    });
  }

  async function executeDeploy(programId: string) {
    setDeploying(programId);
    try {
      const res = await fetch(`/api/communities/${slug}/programs/${programId}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Deploy failed");
      toast.success(data.message);
      if (data.settlementId) {
        toast.message("Settlement recorded", {
          description: `Batch ${data.settlementId}`,
          action: data.explorerUrls?.[0]
            ? { label: "Explorer", onClick: () => window.open(data.explorerUrls[0], "_blank") }
            : undefined,
        });
      }
      if (data.community) {
        const mode = tab === "advanced" ? "full" : "lite";
        queryClient.setQueryData(queryKeys.communitySurface(slug, mode), data.community);
      } else await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
      throw err;
    } finally {
      setDeploying(null);
    }
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
            description: "Fund the pool or edit rules before settlement.",
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

      if (!pendingProgramId) return;

      if (confirm.kind === "approve_payouts" && confirm.needsFund) {
        setConfirm(null);
        ops.fundProgram(
          pendingProgramId,
          slug,
          `Fund $${confirm.fundingGapUsd.toFixed(2)} gap`,
          Math.max(5, confirm.fundingGapUsd),
        );
        return;
      }

      if (confirm.kind === "deploy" || confirm.kind === "approve_payouts") {
        await executeDeploy(pendingProgramId);
        setConfirm(null);
        setPendingProgramId(null);
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

  const installed = surface?.installed ?? false;
  const surfaceLoading = loading && !surface;

  const consoleHref = `/communities/${slug}`;
  const advancedHref = `/communities/${slug}?tab=advanced`;

  return (
    <ProductPage
      icon={Music2}
      title={catalog.name}
      description={catalog.tagline}
      workflows={[
        { label: "Console", href: consoleHref, active: tab === "console" },
        { label: "Sources", href: advancedHref, active: tab === "advanced" },
        { label: "Discover", href: "/discover" },
        { label: "Capital", href: "/capital" },
      ]}
      width="wide"
      accent="emerald"
      actions={
        loadFailed ? null : !installed ? (
          <InstallResolveCard community={catalog} installed={false} compact />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            RESOLVE connected
          </span>
        )
      }
    >
      <CommunityIntentBanner
        intent={pageIntent}
        role={discoverRole}
        catalog={catalog}
        installed={installed}
      />

      {loadFailed ? (
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
          {surfaceLoading ? (
            <CommunityConsoleSkeleton />
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : surfaceLoading || !surface ? (
        <CommunityConsoleSkeleton />
      ) : tab === "advanced" ? (
        <CommunityAdvancedPanel slug={slug} surface={surface} onRefresh={() => void refresh()} />
      ) : (
        <CommunityConsole
          slug={slug}
          catalog={catalog}
          surface={surface}
          connections={connections}
          busy={ops.busy || Boolean(deploying) || confirmBusy}
          deploying={deploying}
          obligationsFilter={obligationsFilter}
          onObligationsFilterChange={setObligationsFilter}
          onRequestDeploy={openDeployConfirm}
          onFund={(programId, label, amountUsd) =>
            ops.fundProgram(programId, slug, label, amountUsd)
          }
          onRequestCreateProgram={openCreateConfirm}
          onRequestApprovePayouts={openApproveConfirm}
          onRefresh={() => void refresh()}
        />
      )}

      <CommunityFundSheetHost slug={slug} ops={ops} />
      <CommunityConfirmSheet
        open={Boolean(confirm)}
        request={confirm}
        busy={ops.busy || Boolean(deploying) || confirmBusy}
        onClose={() => {
          setConfirm(null);
          setPendingProgramId(null);
        }}
        onConfirm={() => void handleConfirm()}
      />
    </ProductPage>
  );
}
