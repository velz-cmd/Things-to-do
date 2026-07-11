"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { PoolFundedBadge } from "@/components/resolve/fund/pool-funded-badge";
import { useMyPoolStakes } from "@/hooks/use-my-pool-stakes";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { visibleDiscoverActions } from "@/lib/discover/discover-visible-actions";
import { DomainArtwork } from "@/components/resolve/visuals/evidence-network";

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  oss: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  music: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  research: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100",
  dao: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  community: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  protocol: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
};

type DiscoverActionCardProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  rank?: number;
  compact?: boolean;
  surface?: string;
};

export function DiscoverActionCard({
  gap,
  signedIn: _signedIn,
  intent = "all",
  role = "all",
  rank,
  compact,
  surface = "action-card",
}: DiscoverActionCardProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { fundedUsdForProgram } = useMyPoolStakes();
  const { state: connections } = useUserConnections();
  const fundedUsd = fundedUsdForProgram(gap.programId);
  const actions = tailorDiscoverActionsForUser(
    visibleDiscoverActions(gap.actions, surface),
    connections,
  );
  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );
  const movable = formatDiscoverMoney(
    gap.moneyCanMoveUsd,
    gap.amountVerified && gap.moneyCanMoveUsd > 0,
    gap.dataSource,
    gap.amountKind,
  );

  useEffect(() => {
    for (const action of actions) {
      registerVisibleAction(surface, action);
    }
  }, [actions, registerVisibleAction, surface]);

  return (
    <DiscoverCapitalCard
      as="article"
      className={clsx(
        "discover-action-card",
        compact ? "discover-action-card--compact" : "discover-action-card--full",
      )}
      padding={false}
    >
      <div className={compact ? "p-3" : "p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null && (
              <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                #{rank}
              </span>
            )}
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                DOMAIN_BADGE_CLASS[gap.domain] ?? "border-white/10 bg-white/[0.06] text-resolve-muted",
              )}
            >
              {gap.domain}
            </span>
            {gap.needType && (
              <span
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                  needTypeBadgeClass(gap.needType),
                )}
              >
                {needTypeLabel(gap.needType)}
              </span>
            )}
            <DiscoverSourceBadge
              source={gap.dataSource}
              estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)}
            />
            {fundedUsd >= 5 && <PoolFundedBadge amountUsd={fundedUsd} compact />}
          </div>
          <h3 className={clsx("mt-1 font-medium text-white", compact ? "text-sm" : "text-base")}>
            {gap.headline}
          </h3>
          {!compact && (
            <>
              <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{gap.why}</p>
              {gap.eligibilityCriteria && (
                <p className="mt-1 text-[10px] text-amber-200/70">{gap.eligibilityCriteria}</p>
              )}
              <p className="mt-1 text-[11px] text-resolve-muted-dim">{gap.whoBenefits}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-3 text-right">
          {!compact && <DomainArtwork domain={gap.domain} className="hidden w-24 sm:block" />}
          <div>
          <p
            className={clsx(
              "text-lg font-semibold tabular-nums",
              needed.tone === "verified"
                ? "text-amber-200"
                : needed.tone === "estimate"
                  ? "text-amber-200/70"
                  : "text-resolve-muted",
            )}
          >
            {needed.label}
          </p>
          {gap.amountVerified &&
            gap.moneyCanMoveUsd > 0 &&
            gap.moneyCanMoveUsd !== gap.amountNeededUsd && (
              <p
                className={clsx(
                  "text-[10px]",
                  movable.tone === "verified" ? "text-emerald-300/80" : "text-resolve-muted",
                )}
              >
                {movable.label} can move
              </p>
            )}
          {gap.peopleImpacted > 0 && (
            <p className="mt-1 text-[10px] text-resolve-muted">
              {gap.peopleImpacted} impacted
            </p>
          )}
          </div>
        </div>
      </div>

      <div className={clsx("flex flex-wrap gap-2", compact ? "mt-2" : "mt-4")}>
        {actions.length > 0 ? (
          actions.map((action, index) => (
            <ActionChip
              key={`${action.id}-${action.kind}-${index}`}
              action={action}
              primary={index === 0}
              connections={connections}
              onClick={() => void runAction(action, surface)}
            />
          ))
        ) : (
          <p className="text-[11px] text-resolve-muted-dim">
            No actions for this row — refresh or connect sources in Profile.
          </p>
        )}
      </div>
      </div>
    </DiscoverCapitalCard>
  );
}

function ActionChip({
  action,
  primary,
  onClick,
  connections,
}: {
  action: DiscoverAction;
  primary?: boolean;
  onClick: () => void;
  connections: ReturnType<typeof useUserConnections>["state"];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "discover-action-btn",
        primary ? "discover-action-btn--primary" : "discover-action-btn--secondary",
        `discover-action-btn--${action.kind}`,
      )}
    >
      {friendlyDiscoverActionLabel(action, connections)}
    </button>
  );
}

export function DiscoverActionChip({
  action,
  signedIn: _signedIn,
  primary,
  surface = "action-chip",
}: {
  action: DiscoverAction;
  signedIn: boolean;
  primary?: boolean;
  surface?: string;
}) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const tailored = tailorDiscoverActionsForUser([action], connections)[0] ?? action;

  useEffect(() => {
    registerVisibleAction(surface, tailored);
  }, [tailored, registerVisibleAction, surface]);

  return (
    <button
      type="button"
      onClick={() => void runAction(tailored, surface)}
      className={clsx(
        "discover-action-btn",
        primary ? "discover-action-btn--primary" : "discover-action-btn--secondary",
        `discover-action-btn--${tailored.kind}`,
      )}
    >
      {friendlyDiscoverActionLabel(tailored, connections)}
    </button>
  );
}
