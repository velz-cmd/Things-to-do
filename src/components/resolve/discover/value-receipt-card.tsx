"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverCardLane } from "@/lib/discover/types";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { deriveDiscoverCardState } from "@/lib/discover/discover-card-state";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { DiscoverCommunityLogo } from "@/components/resolve/discover/discover-community-logo";
import { DiscoverActionBar } from "@/components/resolve/discover/discover-action-bar";
import { Money } from "@/components/resolve/ui/money";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { rfbBadgeForTemplate } from "@/lib/discover/rfb-badges";
import { buildPoolPeopleLine } from "@/lib/discover/pool-discover-copy";
import { useMyPoolStakes } from "@/hooks/use-my-pool-stakes";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useProgramPoolState } from "@/components/resolve/communities/pool-checkpoint-panel";
import { PoolMilestoneBar } from "@/components/resolve/discover/pool-milestone-bar";
import { PoolBatchPayeeCompact } from "@/components/resolve/discover/pool-batch-payee-compact";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import { resolveGapDisplayAmounts } from "@/lib/discover/gap-display-amounts";
import { gapProofHref } from "@/lib/discover/gap-rules";
import { buildPreviewCohortPayees } from "@/lib/discover/preview-cohort-payees";
import { latestFundForCommunity } from "@/lib/capital/fund-action-store";

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  oss: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  music: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  research: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100",
  dao: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  community: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  protocol: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
};

export type ValueReceiptSource =
  | { kind: "gap"; gap: TrendingValueGap }
  | { kind: "program"; program: FundableOpportunity };

type ValueReceiptCardProps = {
  source: ValueReceiptSource;
  signedIn: boolean;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  rank?: number;
  surface?: string;
  lane?: DiscoverCardLane;
  className?: string;
  /** Board rows — inline fund amount + handler */
  fundAmountUsd?: string;
  onFundAmountChange?: (value: string) => void;
  onFund?: () => void;
  fundingBusy?: boolean;
};

function gapFromSource(source: ValueReceiptSource): TrendingValueGap {
  if (source.kind === "gap") return source.gap;
  const p = source.program;
  return {
    id: p.programId,
    domain: "community",
    headline: p.programName,
    why: p.whyFund,
    whoBenefits: p.whoBenefits,
    proofSource: "supabase_ledger",
    dataSource: "supabase_ledger",
    amountVerified: true,
    amountNeededUsd: p.fundingGapUsd,
    moneyCanMoveUsd: p.impactValueUsd,
    peopleImpacted: p.contributorCount,
    trendScore: p.score,
    communitySlug: p.communitySlug,
    programId: p.programId,
    templateId: p.templateId,
    needType: p.needType,
    actions: [
      {
        id: "fund",
        kind: "fund",
        label: "Fulfill pool",
        programId: p.programId,
        communitySlug: p.communitySlug,
        templateId: p.templateId,
        whyFund: p.whyFund,
        whoBenefits: p.whoBenefits,
        programName: p.programName,
      },
    ],
  };
}

/** Phase A — Value Receipt card: real USD, milestone bar, 3 actions. */
export function ValueReceiptCard({
  source,
  signedIn,
  intent: _intent = "all",
  role = "all",
  rank,
  surface = "value-receipt",
  lane = "gaps",
  className,
  fundAmountUsd,
  onFundAmountChange,
  onFund,
  fundingBusy,
}: ValueReceiptCardProps) {
  const gap = gapFromSource(source);
  const { runAction, wallet } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const { fundedUsdForProgram, fundedUsdForCommunity } = useMyPoolStakes();
  const programId = gap.programId;
  const communitySlug = gap.communitySlug;
  const { pool, loading: poolLoading, resolvedProgramId } = useProgramPoolState(
    communitySlug ?? "",
    programId ?? null,
    { templateId: gap.templateId, scope: "community" },
  );
  const effectiveProgramId = programId ?? resolvedProgramId ?? null;

  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;
  const fundedProgramUsd = fundedUsdForProgram(effectiveProgramId);
  const fundedCommunityUsd = fundedUsdForCommunity(communitySlug, gap.templateId);
  const localFund = latestFundForCommunity(communitySlug ?? "", gap.templateId);
  const amounts = resolveGapDisplayAmounts({
    gap,
    pool,
    fundedUsdForProgram: fundedProgramUsd,
    fundedUsdForCommunity: fundedCommunityUsd,
    yourDepositFromPool: pool?.funder.yourDepositUsd ?? 0,
  });
  const {
    displayOwedUsd: owedUsd,
    displayPoolUsd: poolBalanceUsd,
    displayHeroUsd: heroUsd,
    yourDepositUsd,
    contributorCount,
    isEstimate,
  } = amounts;
  const card = useMemo(
    () =>
      deriveDiscoverCardState(gap, connections, lane, role, surface, {
        signedIn,
        spendableUsd,
        poolBalanceUsd,
        yourDepositUsd,
      }),
    [gap, connections, lane, role, surface, signedIn, spendableUsd, poolBalanceUsd, yourDepositUsd],
  );

  useEffect(() => {
    for (const slot of card.actionSlots) {
      registerVisibleAction(surface, slot.action);
    }
  }, [card.actionSlots, registerVisibleAction, surface]);

  const handleAction = (action: DiscoverAction) => {
    const slot = card.actionSlots.find(
      (s) => s.action.id === action.id && s.action.kind === action.kind,
    );
    if (slot?.disabled) return;
    void runAction(
      {
        ...action,
        ...(action.kind === "fund" || action.kind === "sponsor"
          ? { programId: undefined }
          : { programId: action.programId ?? effectiveProgramId ?? undefined }),
        communitySlug: action.communitySlug ?? communitySlug ?? undefined,
        templateId: action.templateId ?? gap.templateId,
      },
      surface,
    );
  };

  const catalogOwedUsd = amounts.catalogEstimateUsd;
  const estimateUsd =
    pool?.funder.estimatedShareOfOwedUsd ??
    (gap.amountVerified ? gap.moneyCanMoveUsd : isEstimate ? catalogOwedUsd : 0);
  const heroLabel = poolBalanceUsd > 0 ? "Pool funded" : "Owed to creators";
  const hasInstantAmounts =
    owedUsd > 0 || poolBalanceUsd > 0 || yourDepositUsd > 0 || Boolean(localFund);
  const peopleLine =
    pool && pool.contributorCount > 0
      ? buildPoolPeopleLine({
          contributorCount: pool.contributorCount,
          funderCount: pool.funderCount,
          payeeCategory: pool.payeeCategory,
        })
      : contributorCount > 0
        ? buildPoolPeopleLine({
            contributorCount,
            funderCount: pool?.funderCount ?? 0,
            payeeCategory: pool?.payeeCategory ?? "creators",
          })
        : null;
  const poolRefreshing = poolLoading && !pool && !hasInstantAmounts;
  const milestoneSegment = computePoolMilestoneSegment(poolBalanceUsd);
  const sourcedHook = pool?.sourcedHook ?? null;
  const rfb = rfbBadgeForTemplate(gap.templateId);
  const proofHref = gapProofHref(gap, localFund?.id ?? null);
  const previewCohort =
    gap.communitySlug && gap.dataSource === "community_catalog"
      ? buildPreviewCohortPayees(gap.communitySlug, milestoneSegment.ceilingUsd)
      : null;
  const cohortPayees =
    pool?.nextBatchPayees?.length
      ? pool.nextBatchPayees.map((p) => ({ label: p.label, owedUsd: p.owedUsd }))
      : gap.cohortPayees?.length
        ? gap.cohortPayees
        : previewCohort;

  const showInlineFund = Boolean(onFund);

  return (
    <article className={clsx("value-receipt-card relative", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <DiscoverCommunityLogo gap={gap} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {rank != null && (
                <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                  #{rank}
                </span>
              )}
              {gap.ecosystem ? (
                <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium uppercase text-sky-200/90">
                  {gap.ecosystem}
                </span>
              ) : (
                <span
                  className={clsx(
                    "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                    DOMAIN_BADGE_CLASS[gap.domain] ?? "border-white/10 bg-white/[0.06] text-resolve-muted",
                  )}
                >
                  {gap.domain}
                </span>
              )}
              {gap.needType && (
                <span
                  className={clsx(
                    "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                    needTypeBadgeClass(gap.needType),
                  )}
                >
                  {needTypeLabel(gap.needType)}
                </span>
              )}
              {rfb && (
                <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-violet-200">
                  {rfb.trackLabel}
                </span>
              )}
              <DiscoverSourceBadge
                source={gap.dataSource}
                estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)}
              />
            </div>
            <h3 className="mt-1 text-[13px] font-semibold leading-snug text-white">{card.title}</h3>
            {peopleLine && (
              <p className="mt-1 text-[10px] font-medium text-emerald-200/90">{peopleLine}</p>
            )}
            {sourcedHook ? (
              <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">{sourcedHook}</p>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted-dim">{gap.why}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            {heroLabel}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-300">
            <Money amount={heroUsd} size="sm" className="inline" />
            {poolRefreshing && (
              <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-resolve-muted" />
            )}
          </p>
          {isEstimate && poolBalanceUsd <= 0 && (
            <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Est. unpaid</p>
          )}
          {poolBalanceUsd > 0 && owedUsd > 0 && poolBalanceUsd !== owedUsd && (
            <p className="text-[10px] tabular-nums text-amber-200/80">
              <Money amount={owedUsd} size="sm" className="inline" /> owed
            </p>
          )}
        </div>
      </div>

      <dl
        className={clsx(
          "mt-3 grid gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[11px]",
          contributorCount > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        )}
      >
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Pool</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-300">
            <Money amount={poolBalanceUsd} size="sm" className="inline" />
            {poolRefreshing && (
              <Loader2 className="ml-0.5 inline h-3 w-3 animate-spin text-resolve-muted" />
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Your deposit</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-white">
            {signedIn ? (
              <Money amount={yourDepositUsd} size="sm" className="inline" />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Owed</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-amber-200">
            {isEstimate && owedUsd > 0 && (
              <span className="mr-1 text-[8px] font-normal uppercase text-resolve-muted-dim">
                Est.
              </span>
            )}
            <Money amount={owedUsd} size="sm" className="inline" />
          </dd>
        </div>
        {contributorCount > 0 && (
          <div>
            <dt className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">Contributors</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-white">{contributorCount}</dd>
          </div>
        )}
      </dl>

      {estimateUsd > 0 && estimateUsd !== owedUsd && (
        <p className="mt-2 border-t border-dashed border-white/[0.08] pt-2 text-[10px] text-resolve-muted-dim">
          <span className="text-resolve-muted">Estimate · </span>
          <Money amount={estimateUsd} size="sm" className="inline text-amber-200/70" /> can move when
          pool clears authorizations
        </p>
      )}

      <PoolMilestoneBar poolUsd={poolBalanceUsd} segment={milestoneSegment} compact />
      <p className="mt-2 text-[10px] text-emerald-300/85">
        Autopay when milestone is reached — funders do not pick payees
      </p>

      {pool && pool.funderCount > 0 && (
        <p className="mt-2 text-[10px] text-resolve-muted">
          <span className="font-medium text-emerald-200/90">
            {pool.funderCount} funder{pool.funderCount === 1 ? "" : "s"}
          </span>
          {" · "}
          <Money amount={poolBalanceUsd} size="sm" className="inline text-white/90" /> communal pool
          {yourDepositUsd > 0 ? (
            <>
              {" · your share "}
              <Money amount={yourDepositUsd} size="sm" className="inline text-white/90" />
              {pool.funder.yourSharePct > 0 ? ` (${pool.funder.yourSharePct}%)` : ""}
            </>
          ) : null}
        </p>
      )}

      {cohortPayees && cohortPayees.length > 0 && (
        <PoolBatchPayeeCompact
          payees={cohortPayees}
          ceilingUsd={milestoneSegment.ceilingUsd}
          payeeCategory={pool?.payeeCategory ?? "creators"}
        />
      )}
      {yourDepositUsd > 0 && localFund && (
        <p className="mt-2 text-[10px] text-emerald-200/90">
          You funded ${yourDepositUsd.toFixed(2)}
          {localFund.fundingSource === "external" ? " from connected wallet" : " on Arc"}
          {localFund.txHash ? " · memo settlement pending batch" : ""}
          {proofHref ? (
            <>
              {" · "}
              <Link href={proofHref} className="text-resolve-accent hover:underline">
                View proof receipt
              </Link>
            </>
          ) : null}
        </p>
      )}
      {showInlineFund ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
          {signedIn ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-resolve-muted">$</span>
                <input
                  type="number"
                  min={5}
                  step="0.01"
                  value={fundAmountUsd ?? "5"}
                  onChange={(e) => onFundAmountChange?.(e.target.value)}
                  className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                />
              </div>
              <button
                type="button"
                disabled={fundingBusy}
                onClick={() => onFund?.()}
                className="discover-action-btn discover-action-btn--primary discover-action-btn--fund min-h-[34px] px-4 py-2 text-[12px] font-semibold"
              >
                {fundingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fulfill pool"}
              </button>
            </>
          ) : (
            <Link
              href="/login?next=/discover%23opportunities"
              className="discover-action-btn discover-action-btn--primary min-h-[34px] px-4 py-2 text-[12px] font-semibold"
            >
              Sign in to fulfill pool
            </Link>
          )}
          {proofHref && (
            <Link href={proofHref} className="text-[11px] text-resolve-muted hover:text-resolve-accent">
              View proof →
            </Link>
          )}
        </div>
      ) : (
        <DiscoverActionBar
          slots={card.actionSlots}
          advanced={[]}
          connections={connections}
          onAction={handleAction}
          primarySubtext={card.narrative.primarySubtext}
        />
      )}

      {!signedIn && (
        <p className="mt-2 text-[10px] text-amber-200/80">
          Sign in to fulfill pools — guest mode cannot move USDC on Arc.
        </p>
      )}
    </article>
  );
}
