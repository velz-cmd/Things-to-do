"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CheckCircle2, Clock3, FileCheck2, Loader2, Radio, Users } from "lucide-react";
import type { DiscoverAction, DiscoverCardLane, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
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
import styles from "./discover-workspace.module.css";

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  oss: "border-cyan-500/25 bg-cyan-500/[0.07] text-cyan-100",
  music: "border-violet-500/25 bg-violet-500/[0.07] text-violet-100",
  research: "border-indigo-500/25 bg-indigo-500/[0.07] text-indigo-100",
  dao: "border-fuchsia-500/25 bg-fuchsia-500/[0.07] text-fuchsia-100",
  community: "border-sky-500/25 bg-sky-500/[0.07] text-sky-100",
  protocol: "border-blue-500/25 bg-blue-500/[0.07] text-blue-100",
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
  fundAmountUsd?: string;
  onFundAmountChange?: (value: string) => void;
  onFund?: () => void;
  fundingBusy?: boolean;
};

function gapFromSource(source: ValueReceiptSource): TrendingValueGap {
  if (source.kind === "gap") return source.gap;
  const program = source.program;
  return {
    id: program.programId,
    domain: "community",
    headline: program.programName,
    why: program.whyFund,
    whoBenefits: program.whoBenefits,
    proofSource: "supabase_ledger",
    dataSource: "supabase_ledger",
    amountVerified: true,
    amountNeededUsd: program.fundingGapUsd,
    moneyCanMoveUsd: program.impactValueUsd,
    peopleImpacted: program.contributorCount,
    trendScore: program.score,
    communitySlug: program.communitySlug,
    programId: program.programId,
    templateId: program.templateId,
    needType: program.needType,
    opportunityScorecard: program.opportunityScorecard,
    actions: [
      {
        id: "fund",
        kind: "fund",
        label: "Fulfill pool",
        programId: program.programId,
        communitySlug: program.communitySlug,
        templateId: program.templateId,
        whyFund: program.whyFund,
        whoBenefits: program.whoBenefits,
        programName: program.programName,
      },
    ],
  };
}

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
  const { pool, loading: poolLoading, resolvedProgramId } = useProgramPoolState(
    gap.communitySlug ?? "",
    gap.programId ?? null,
    { templateId: gap.templateId, scope: "community" },
  );
  const effectiveProgramId = gap.programId ?? resolvedProgramId ?? null;
  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;
  const localFund = latestFundForCommunity(gap.communitySlug ?? "", gap.templateId);
  const amounts = resolveGapDisplayAmounts({
    gap,
    pool,
    fundedUsdForProgram: fundedUsdForProgram(effectiveProgramId),
    fundedUsdForCommunity: fundedUsdForCommunity(gap.communitySlug, gap.templateId),
    yourDepositFromPool: pool?.funder.yourDepositUsd ?? 0,
  });
  const {
    displayOwedUsd: owedUsd,
    displayPoolUsd: poolBalanceUsd,
    yourDepositUsd,
    contributorCount,
    isEstimate,
  } = amounts;
  const card = useMemo(
    () => deriveDiscoverCardState(gap, connections, lane, role, surface, {
      signedIn,
      spendableUsd,
      poolBalanceUsd,
      yourDepositUsd,
    }),
    [gap, connections, lane, role, surface, signedIn, spendableUsd, poolBalanceUsd, yourDepositUsd],
  );

  useEffect(() => {
    for (const slot of card.actionSlots) registerVisibleAction(surface, slot.action);
  }, [card.actionSlots, registerVisibleAction, surface]);

  const handleAction = (action: DiscoverAction) => {
    const slot = card.actionSlots.find(
      (candidate) => candidate.action.id === action.id && candidate.action.kind === action.kind,
    );
    if (slot?.disabled) return;
    void runAction(
      {
        ...action,
        ...(action.kind === "fund" || action.kind === "sponsor"
          ? { programId: undefined }
          : { programId: action.programId ?? effectiveProgramId ?? undefined }),
        communitySlug: action.communitySlug ?? gap.communitySlug ?? undefined,
        templateId: action.templateId ?? gap.templateId,
      },
      surface,
    );
  };

  const hasInstantAmounts = owedUsd > 0 || poolBalanceUsd > 0 || yourDepositUsd > 0 || Boolean(localFund);
  const poolRefreshing = poolLoading && !pool && !hasInstantAmounts;
  const milestoneSegment = computePoolMilestoneSegment(poolBalanceUsd);
  const proofHref = gapProofHref(gap, localFund?.id ?? null);
  const peopleLine = contributorCount > 0
    ? buildPoolPeopleLine({
        contributorCount,
        funderCount: pool?.funderCount ?? 0,
        payeeCategory: pool?.payeeCategory ?? "creators",
      })
    : null;
  const previewCohort = gap.communitySlug && gap.dataSource === "community_catalog"
    ? buildPreviewCohortPayees(gap.communitySlug, milestoneSegment.ceilingUsd)
    : null;
  const cohortPayees = pool?.nextBatchPayees?.length
    ? pool.nextBatchPayees.map((payee) => ({ label: payee.label, owedUsd: payee.owedUsd }))
    : gap.cohortPayees?.length
      ? gap.cohortPayees
      : previewCohort;
  const rfb = rfbBadgeForTemplate(gap.templateId);
  const summary = pool?.sourcedHook ?? gap.why;
  const evidenceLabel = domainEvidenceLabel(gap.domain);
  const confidence = gap.opportunityScorecard?.chips.find((chip) => chip.dimension === "confidence");
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; programId?: string | null }>).detail;
      setSelected(Boolean(detail && (detail.id === gap.id || (detail.programId && detail.programId === effectiveProgramId))));
    };
    window.addEventListener("resolve.discover.entity-selected", handleSelection);
    return () => window.removeEventListener("resolve.discover.entity-selected", handleSelection);
  }, [gap.id, effectiveProgramId]);

  const announceSelection = () => {
    window.dispatchEvent(new CustomEvent("resolve.discover.entity-selected", {
      detail: {
        id: gap.id,
        programId: effectiveProgramId,
        communitySlug: gap.communitySlug,
        label: card.title,
      },
    }));
  };

  if (lane === "radars") {
    return (
      <article className={clsx(styles.signalRecord, selected && styles.selectedRecord, className)} onFocusCapture={announceSelection}>
        <div className={styles.signalTime}>
          <span><span className={styles.signalLiveDot} aria-hidden="true" />{formatRelativeSignal(gap.updatedAt)}</span>
          <span className={styles.signalSource}>{gap.ecosystem ?? gap.domain}</span>
        </div>
        <div className={styles.signalMain}>
          <div className={styles.badges}>
            <DiscoverSourceBadge source={gap.dataSource} estimate={!gap.amountVerified} />
            {gap.needType && (
              <span className={clsx("rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase", needTypeBadgeClass(gap.needType))}>
                {needTypeLabel(gap.needType)}
              </span>
            )}
          </div>
          <h3 className={styles.signalTitle}>{card.title}</h3>
          <p className={styles.signalEvidence}>{summary}</p>
          <div className={styles.signalMetrics}>
            {contributorCount > 0 && <span><Users className="mr-1 inline h-3 w-3" />{contributorCount} affected</span>}
            {confidence && <span>{confidence.value}% confidence · {confidence.display}</span>}
            {owedUsd > 0 && <span>{isEstimate ? "Est. " : ""}<Money amount={owedUsd} size="sm" className="inline" /> potential value</span>}
            <span>{evidenceLabel}</span>
          </div>
        </div>
        <div className={styles.signalActions}>
          <DiscoverActionBar
            slots={card.actionSlots}
            advanced={[]}
            connections={connections}
            onAction={handleAction}
            className={styles.recordActionBar}
          />
          {proofHref && <Link href={proofHref} className="mt-2 inline-flex text-[10px] text-blue-300 hover:text-white">Inspect proof →</Link>}
        </div>
      </article>
    );
  }

  if (source.kind === "program" && lane === "graph") {
    const requiredUsd = Math.max(0, source.program.fundingGapUsd);
    const remainingUsd = Math.max(0, requiredUsd - poolBalanceUsd);
    const evidenceReady = gap.amountVerified && gap.dataSource !== "community_catalog";
    return (
      <article className={clsx(styles.fundingRecord, selected && styles.selectedRecord, className)} onFocusCapture={announceSelection}>
        <div className={styles.fundingIdentity}>
          <DiscoverCommunityLogo gap={gap} />
          <div className="min-w-0">
            <h3 className={styles.fundingTitle}>{card.title}</h3>
            <p className={styles.fundingMeta}>
              {source.program.communityName} · {evidenceLabel} · {source.program.status.replace(/_/g, " ")}
              {proofHref && <> · <Link href={proofHref} className="text-blue-300 hover:text-white">Proof</Link></>}
            </p>
          </div>
        </div>
        <div className={styles.fundingCell}><Money amount={requiredUsd} size="sm" className="inline" /></div>
        <div className={styles.fundingCell}><Money amount={poolBalanceUsd} size="sm" className="inline text-blue-200" /></div>
        <div className={styles.fundingCell}>
          <span className={clsx(styles.readiness, evidenceReady && styles.readinessReady)}>
            <span className={styles.readinessDot} aria-hidden="true" />
            {evidenceReady ? "Evidence ready" : "Awaiting source"}
          </span>
          <span className="mt-1 block text-[9px] text-resolve-muted-dim"><Money amount={remainingUsd} size="sm" className="inline" /> remaining</span>
        </div>
        <div className={styles.fundingActions}>
          {signedIn && onFund ? (
            <>
              <input
                aria-label={`Funding amount for ${card.title}`}
                type="number"
                min={5}
                step="0.01"
                value={fundAmountUsd ?? "5"}
                onChange={(event) => onFundAmountChange?.(event.target.value)}
              />
              <button
                type="button"
                disabled={fundingBusy}
                onClick={() => onFund()}
                className="discover-action-btn discover-action-btn--primary discover-action-btn--fund px-4 text-[12px] font-semibold"
              >
                {fundingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fund"}
              </button>
            </>
          ) : (
            <Link href="/login?next=/discover%23opportunities" className="discover-action-btn discover-action-btn--primary col-span-2 px-4 text-[12px] font-semibold">
              Sign in to fund
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={clsx(styles.opportunityRecord, selected && styles.selectedRecord, className)} tabIndex={0} onFocusCapture={announceSelection}>
      <div className={styles.opportunityMain}>
        <div className={styles.identityZone}>
          <div className={styles.identityHeader}>
            <DiscoverCommunityLogo gap={gap} />
            <div className="min-w-0 flex-1">
              <div className={styles.badges}>
                {rank != null && <span className="font-mono text-[9px] tabular-nums text-resolve-muted-dim">#{rank}</span>}
                <span className={clsx("rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase", DOMAIN_BADGE_CLASS[gap.domain])}>{gap.ecosystem ?? gap.domain}</span>
                {gap.needType && <span className={clsx("rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase", needTypeBadgeClass(gap.needType))}>{needTypeLabel(gap.needType)}</span>}
                {rfb && <span className="rounded border border-violet-500/25 bg-violet-500/[0.07] px-1.5 py-0.5 text-[8px] font-medium uppercase text-violet-200">{rfb.trackLabel}</span>}
                <DiscoverSourceBadge source={gap.dataSource} estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)} />
              </div>
              <h3 className={styles.recordTitle}>{card.title}</h3>
              <p className={styles.evidenceSummary}>{summary}</p>
              <div className={styles.evidenceMeta}>
                <span><FileCheck2 className="h-3 w-3 text-cyan-300" />{evidenceLabel}</span>
                {peopleLine && <span><Users className="h-3 w-3" />{peopleLine}</span>}
                <span>{gap.amountVerified ? <CheckCircle2 className="h-3 w-3 text-blue-300" /> : <Clock3 className="h-3 w-3 text-amber-300" />}{gap.amountVerified ? "Verified evidence" : "Estimate · source proof pending"}</span>
                {proofHref && <Link href={proofHref} className="text-blue-300 hover:text-white">View proof →</Link>}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.economicsZone}>
          <p className={styles.zoneLabel}>Economics</p>
          <dl className={clsx(styles.metricStrip, styles.economicsMetricStrip)}>
            <Metric label="Pool" value={<><Money amount={poolBalanceUsd} size="sm" className="inline" />{poolRefreshing && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</>} tone="blue" />
            <Metric label="Owed" value={<>{isEstimate && <span className="mr-1 text-[8px] font-normal">Est.</span>}<Money amount={owedUsd} size="sm" className="inline" /></>} tone="amber" />
            <Metric label="Your deposit" value={signedIn ? <Money amount={yourDepositUsd} size="sm" className="inline" /> : "—"} />
            <Metric label="Contributors" value={String(contributorCount)} />
          </dl>
        </div>

        <div className={styles.actionsZone}>
          <p className={styles.zoneLabel}>Actions</p>
          <DiscoverActionBar
            slots={card.actionSlots}
            advanced={[]}
            connections={connections}
            onAction={handleAction}
            primarySubtext={card.narrative.primarySubtext}
            className={styles.recordActionBar}
          />
        </div>
      </div>

      <div className={styles.recordFooter}>
        <div>
          <PoolMilestoneBar poolUsd={poolBalanceUsd} segment={milestoneSegment} />
          <p className="mt-2 text-[9px] text-resolve-muted">Autopay when the milestone is reached.</p>
          {yourDepositUsd > 0 && localFund && (
            <p className="mt-2 text-[10px] text-emerald-200/90">
              Your deposit: <Money amount={yourDepositUsd} size="sm" className="inline" />
              {localFund.fundingSource === "external" ? " from connected wallet" : " on Arc"}
            </p>
          )}
        </div>
        <div className={styles.contributorsPanel}>
          {cohortPayees && cohortPayees.length > 0 ? (
            <PoolBatchPayeeCompact payees={cohortPayees} ceilingUsd={milestoneSegment.ceilingUsd} payeeCategory={pool?.payeeCategory ?? "creators"} />
          ) : (
            <div className={styles.contributorsSummary}>
              <div>
                <p className={styles.zoneLabel}>Contributor preview</p>
                <p className="mt-1 text-[10px] text-resolve-muted">
                  {contributorCount > 0 ? `${contributorCount} contributors linked to current evidence` : "Contributor allocation appears when proof resolves."}
                </p>
              </div>
              <Radio className="h-4 w-4 text-violet-300" />
            </div>
          )}
        </div>
      </div>

      {!signedIn && <p className="mt-3 text-[10px] text-amber-200/80">Sign in to fulfill pools — guest mode cannot move USDC on Arc.</p>}
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "amber" | "blue" }) {
  return (
    <div className={styles.metric}>
      <dt className={styles.metricLabel}>{label}</dt>
      <dd className={clsx(styles.metricValue, tone === "amber" && styles.metricValueAmber, tone === "blue" && styles.metricValueBlue)}>{value}</dd>
    </div>
  );
}

function domainEvidenceLabel(domain: TrendingValueGap["domain"]) {
  const labels: Record<TrendingValueGap["domain"], string> = {
    oss: "Repository contribution evidence",
    music: "Play and attribution evidence",
    research: "Citation and author evidence",
    dao: "Governance and grant evidence",
    community: "Community activity evidence",
    protocol: "Protocol activity evidence",
  };
  return labels[domain];
}

function formatRelativeSignal(iso?: string) {
  if (!iso) return "Source event";
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return "Source event";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
