"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Ellipsis, Radio, Route, UserRoundCheck } from "lucide-react";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { communityConsolePath, profileConnectPath } from "@/lib/communities/community-nav";
import { getCommunityNextBestAction } from "@/lib/communities/next-best-action";
import { CommunityDomainIcon, communityOperationsDescription } from "./community-identity";
import styles from "./communities.module.css";

export type CommunityOperationalState = "healthy" | "setup" | "review" | "ready";

export function getCommunityOperationalState(
  hubOps: CommunityHubOpsStats | null,
  vitals: CommunityVitalsSummary | null,
): CommunityOperationalState {
  const pending = hubOps?.pendingObligationsUsd ?? 0;
  const next = getCommunityNextBestAction({
    installed: true,
    sourceConnected: Boolean(vitals?.sensor.live || vitals?.sensor.ready),
    sourceHealthy: Boolean(vitals?.sensor.ready),
    syncCompleted: Boolean(vitals?.hasLiveData),
    programCount: hubOps?.programCount ?? vitals?.programCount ?? 0,
    unresolvedIdentityCount: hubOps?.unresolvedIdentityCount ?? 0,
    obligationCount: hubOps?.pendingCount ?? 0,
    simulationComplete: hubOps?.simulationComplete ?? false,
    fundingGapUsd: Math.max(0, pending - (hubOps?.treasuryUsd ?? vitals?.fundingTotalUsd ?? 0)),
    settlementReady: hubOps?.settlementReady ?? false,
  });
  if (next.state === "settlement_ready") return "ready";
  if (["identity_review", "obligation_review", "simulation_required", "capital_required"].includes(next.state)) return "review";
  if (["source_required", "sync_required", "policy_required"].includes(next.state)) return "setup";
  return "healthy";
}

const STATE_LABEL: Record<CommunityOperationalState, string> = {
  healthy: "Healthy",
  setup: "Needs setup",
  review: "Needs review",
  ready: "Settlement ready",
};

type Props = {
  community: Pick<CommunityCatalogEntry, "slug" | "name" | "tagline" | "kind" | "upstream">;
  hubOps: CommunityHubOpsStats | null;
  vitals: CommunityVitalsSummary | null;
  compact?: boolean;
};

/**
 * Resolves the concrete next action for one community, including its real
 * destination link. Exported so the hub's "Needs your attention" section and
 * this card agree by construction - a community can never point one action
 * from the card and a different one from the summary.
 */
export function communityPrimaryAction(input: {
  slug: string;
  hubOps: CommunityHubOpsStats | null;
  vitals: CommunityVitalsSummary | null;
}) {
  const { slug, hubOps, vitals } = input;
  const pendingUsd = hubOps?.pendingObligationsUsd ?? 0;
  const nextAction = getCommunityNextBestAction({
    installed: true,
    sourceConnected: Boolean(vitals?.sensor.live || vitals?.sensor.ready),
    sourceHealthy: Boolean(vitals?.sensor.ready),
    syncCompleted: Boolean(vitals?.hasLiveData),
    programCount: hubOps?.programCount ?? vitals?.programCount ?? 0,
    unresolvedIdentityCount: hubOps?.unresolvedIdentityCount ?? 0,
    obligationCount: hubOps?.pendingCount ?? 0,
    simulationComplete: hubOps?.simulationComplete ?? false,
    fundingGapUsd: Math.max(0, pendingUsd - (hubOps?.treasuryUsd ?? vitals?.fundingTotalUsd ?? 0)),
    settlementReady: hubOps?.settlementReady ?? false,
  });
  switch (nextAction.actionId) {
    case "source.connect": return { ...nextAction, href: profileConnectPath(`/communities/${slug}`) };
    case "program.create_draft": return { ...nextAction, href: communityConsolePath(slug, "create_program") };
    case "obligation.review": return { ...nextAction, href: communityConsolePath(slug, "review_obligations") };
    case "mission.simulate": return { ...nextAction, href: `/mission?community=${slug}&mode=simulate` };
    case "capital.open_funding": return { ...nextAction, href: `/capital?community=${slug}` };
    case "obligation.prepare_settlement": return { ...nextAction, href: `${communityConsolePath(slug)}#settlement-readiness` };
    default: return { ...nextAction, href: communityConsolePath(slug) };
  }
}

export function CommunityOperateCard({ community, hubOps, vitals, compact = false }: Props) {
  const state = getCommunityOperationalState(hubOps, vitals);
  const programs = hubOps?.programCount ?? vitals?.programCount ?? 0;
  const obligationCount = hubOps?.pendingCount ?? 0;
  const identities = hubOps?.builderCount ?? 0;
  const sourceLabel = vitals?.sensor.ready ? "Connected" : vitals?.sensor.live ? "Syncing" : "Needs connection";
  const primary = communityPrimaryAction({ slug: community.slug, hubOps, vitals });

  return (
    <article className={styles.communityCard} data-kind={community.kind} data-compact={compact || undefined}>
      <div className={styles.cardIdentity}>
        <div className={styles.domainIcon}><CommunityDomainIcon slug={community.slug} kind={community.kind} /></div>
        <div><h3>{community.name}</h3><p>{community.upstream}</p></div>
        <span className={styles.stateBadge} data-state={state}><i />{STATE_LABEL[state]}</span>
      </div>
      <p className={styles.cardTagline}>{communityOperationsDescription(community.kind)}</p>
      <div className={styles.cardSignals}>
        <div><Radio /><span>Source health</span><strong data-tone={vitals?.sensor.ready ? "healthy" : "attention"}>{sourceLabel}</strong></div>
        <div><UserRoundCheck /><span>Attributed identities</span><strong>{identities}</strong></div>
        <div><Route /><span>Active programs</span><strong>{programs}</strong></div>
        <div><ArrowUpRight /><span>Open obligations</span><strong>{obligationCount}</strong></div>
      </div>
      <div className={styles.nextStep}><span>Recommended next step</span><p>{primary.reason}</p></div>
      <div className={styles.cardActions}>
        <Link data-action-id={primary.actionId} href={primary.href} className={styles.cardPrimary}>{primary.label}<ArrowRight /></Link>
        {primary.actionId === "source.view_status" ? (
          <Link data-action-id="mission.create" href={`/mission?community=${community.slug}`} className={styles.cardSecondary}>Run Mission</Link>
        ) : (
          <Link data-action-id="community.open" href={communityConsolePath(community.slug)} className={styles.cardSecondary}>Open console</Link>
        )}
        <details className={styles.moreMenu}>
          <summary aria-label={`More actions for ${community.name}`}><Ellipsis /></summary>
          <div><Link data-action-id="mission.create" href={`/mission?community=${community.slug}`}>Analyze in Mission</Link><Link data-action-id="source.connect" href={profileConnectPath(`/communities/${community.slug}`)}>Manage source</Link></div>
        </details>
      </div>
    </article>
  );
}
