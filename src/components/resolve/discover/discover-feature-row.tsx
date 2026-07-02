"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { visibleDiscoverActions } from "@/lib/discover/discover-visible-actions";

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  oss: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  music: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  research: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100",
  dao: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  community: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  protocol: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
};

type DiscoverFeatureRowProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  rank?: number;
  surface?: string;
  maxActions?: number;
};

export function DiscoverFeatureRow({
  gap,
  signedIn: _signedIn,
  intent: _intent = "all",
  role: _role = "all",
  rank,
  surface = "feature-row",
  maxActions = 2,
}: DiscoverFeatureRowProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const actions = tailorDiscoverActionsForUser(
    visibleDiscoverActions(gap.actions, surface),
    connections,
  ).slice(0, maxActions);

  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );

  useEffect(() => {
    for (const action of actions) {
      registerVisibleAction(surface, action);
    }
  }, [actions, registerVisibleAction, surface]);

  return (
    <li className="resolve-signal-service-row px-1 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {rank != null && (
              <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                #{rank}
              </span>
            )}
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase",
                DOMAIN_BADGE_CLASS[gap.domain] ?? "border-white/10 bg-white/[0.06] text-resolve-muted",
              )}
            >
              {gap.domain}
            </span>
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
            <DiscoverSourceBadge
              source={gap.dataSource}
              estimate={!gap.amountVerified && Boolean(gap.proofGithubScanAt)}
            />
          </div>
          <p className="mt-0.5 truncate text-[13px] font-medium text-white">{gap.headline}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-resolve-muted-dim">{gap.why}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {gap.opportunityScorecard && (
            <span className="text-lg font-semibold tabular-nums text-resolve-accent">
              {gap.opportunityScorecard.composite}
            </span>
          )}
          <span
            className={clsx(
              "text-sm font-semibold tabular-nums",
              needed.tone === "verified" ? "text-amber-200" : "text-amber-200/70",
            )}
          >
            {needed.label}
          </span>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {actions.map((action, index) => (
            <button
              key={`${action.id}-${action.kind}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className={clsx(
                "rounded-md border px-2 py-1 text-[10px] font-medium transition",
                index === 0
                  ? "border-resolve-accent/35 bg-resolve-accent/12 text-resolve-accent hover:bg-resolve-accent/18"
                  : "border-white/10 text-resolve-muted hover:border-white/20 hover:text-white",
              )}
            >
              {friendlyDiscoverActionLabel(action)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
