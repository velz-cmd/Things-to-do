"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Ellipsis, Radio, Route, UserRoundCheck } from "lucide-react";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";
import type { CommunityVitalsSummary } from "@/lib/communities/types";
import { communityConsolePath, profileConnectPath } from "@/lib/communities/community-nav";
import { CommunityDomainIcon } from "./community-identity";
import styles from "./communities.module.css";

export type CommunityOperationalState = "healthy" | "setup" | "review" | "ready";

export function getCommunityOperationalState(
  hubOps: CommunityHubOpsStats | null,
  vitals: CommunityVitalsSummary | null,
): CommunityOperationalState {
  const programs = hubOps?.programCount ?? vitals?.programCount ?? 0;
  const pending = hubOps?.pendingObligationsUsd ?? 0;
  const available = hubOps?.treasuryUsd ?? vitals?.fundingTotalUsd ?? 0;
  if (pending > 0.01 && available >= pending) return "ready";
  if ((hubOps?.pendingCount ?? 0) > 0 || pending > 0.01) return "review";
  if (!vitals?.sensor.ready || programs === 0) return "setup";
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

export function CommunityOperateCard({ community, hubOps, vitals, compact = false }: Props) {
  const state = getCommunityOperationalState(hubOps, vitals);
  const programs = hubOps?.programCount ?? vitals?.programCount ?? 0;
  const obligationCount = hubOps?.pendingCount ?? 0;
  const identities = hubOps?.builderCount ?? 0;
  const sourceLabel = vitals?.sensor.ready ? "Connected" : vitals?.sensor.live ? "Syncing" : "Needs connection";
  const primary =
    !vitals?.sensor.ready
      ? { label: "Connect source", href: profileConnectPath(`/communities/${community.slug}`) }
      : programs === 0
        ? { label: "Create program", href: communityConsolePath(community.slug, "create_program") }
        : state === "review"
          ? { label: "Review obligations", href: communityConsolePath(community.slug, "review_obligations") }
          : state === "ready"
            ? { label: "Open settlement review", href: `${communityConsolePath(community.slug)}#settlement-readiness` }
            : { label: "Open console", href: communityConsolePath(community.slug) };
  const nextStep =
    !vitals?.sensor.ready
      ? "Connect the evidence source and run the first synchronization."
      : programs === 0
        ? "Configure a policy for verified activity in this ecosystem."
        : state === "review"
          ? `Review ${obligationCount} recognized obligation${obligationCount === 1 ? "" : "s"}.`
          : state === "ready"
            ? "Review the package before handing authorization to Capital."
            : "Sources and program policy are operating normally.";

  return (
    <article className={styles.communityCard} data-kind={community.kind} data-compact={compact || undefined}>
      <div className={styles.cardIdentity}>
        <div className={styles.domainIcon}><CommunityDomainIcon slug={community.slug} kind={community.kind} /></div>
        <div><h3>{community.name}</h3><p>{community.upstream}</p></div>
        <span className={styles.stateBadge} data-state={state}><i />{STATE_LABEL[state]}</span>
      </div>
      <p className={styles.cardTagline}>{community.tagline}</p>
      <div className={styles.cardSignals}>
        <div><Radio /><span>Source health</span><strong data-tone={vitals?.sensor.ready ? "healthy" : "attention"}>{sourceLabel}</strong></div>
        <div><UserRoundCheck /><span>Attributed identities</span><strong>{identities}</strong></div>
        <div><Route /><span>Active programs</span><strong>{programs}</strong></div>
        <div><ArrowUpRight /><span>Open obligations</span><strong>{obligationCount}</strong></div>
      </div>
      <div className={styles.nextStep}><span>Recommended next step</span><p>{nextStep}</p></div>
      <div className={styles.cardActions}>
        <Link href={primary.href} className={styles.cardPrimary}>{primary.label}<ArrowRight /></Link>
        {primary.label === "Open console" ? (
          <Link href={`/mission?community=${community.slug}`} className={styles.cardSecondary}>Run Mission</Link>
        ) : (
          <Link href={communityConsolePath(community.slug)} className={styles.cardSecondary}>Open console</Link>
        )}
        <details className={styles.moreMenu}>
          <summary aria-label={`More actions for ${community.name}`}><Ellipsis /></summary>
          <div><Link href={`/mission?community=${community.slug}`}>Analyze in Mission</Link><Link href={profileConnectPath(`/communities/${community.slug}`)}>Manage source</Link></div>
        </details>
      </div>
    </article>
  );
}
