"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import {
  deriveDiscoverCardState,
  type DiscoverCardLane,
} from "@/lib/discover/discover-card-state";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";

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
  lane?: DiscoverCardLane;
};

export function DiscoverFeatureRow({
  gap,
  signedIn: _signedIn,
  intent: _intent = "all",
  role = "all",
  rank,
  surface = "feature-row",
  lane = "gaps",
}: DiscoverFeatureRowProps) {
  const { runAction } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const card = useMemo(
    () => deriveDiscoverCardState(gap, connections, lane, role, surface),
    [gap, connections, lane, role, surface],
  );

  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );

  const allVisible = useMemo(
    () => [...card.primaryActions, ...(showAdvanced ? card.advancedActions : [])],
    [card, showAdvanced],
  );

  useEffect(() => {
    for (const action of allVisible) {
      registerVisibleAction(surface, action);
    }
  }, [allVisible, registerVisibleAction, surface]);

  return (
    <li className="resolve-signal-service-row px-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {rank != null && (
              <span className="text-[10px] font-semibold tabular-nums text-resolve-muted-dim">
                #{rank}
              </span>
            )}
            {gap.ecosystem && (
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium uppercase text-sky-200/90">
                {gap.ecosystem}
              </span>
            )}
            {!gap.ecosystem && (
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
            <span className="rounded border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 text-[8px] font-medium text-amber-100/90">
              {card.settlementStatus}
            </span>
          </div>

          <p className="mt-1 text-[13px] font-semibold leading-snug text-white">{card.title}</p>

          <dl className="mt-2 grid gap-1 text-[10px] leading-snug sm:grid-cols-3">
            <div>
              <dt className="text-resolve-muted-dim">Proof</dt>
              <dd className="font-medium text-resolve-muted">{card.proofSource}</dd>
            </div>
            <div>
              <dt className="text-resolve-muted-dim">Missing</dt>
              <dd className="font-medium text-resolve-muted">{card.missingStep}</dd>
            </div>
            <div>
              <dt className="text-resolve-muted-dim">Status</dt>
              <dd className="font-medium text-amber-100/90">{card.settlementStatus}</dd>
            </div>
          </dl>

          <DiscoverProofPipeline
            stages={card.pipeline}
            className="mt-2"
            onStageClick={(stage) => {
              const match = card.primaryActions.find((a) => actionForStage(a, stage.id));
              if (match) void runAction(match, surface);
            }}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={clsx(
              "text-right text-[11px] font-semibold leading-tight tabular-nums",
              needed.tone === "verified" ? "text-amber-200" : "text-amber-200/60",
            )}
          >
            {needed.label}
          </span>
        </div>
      </div>

      {card.primaryActions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {card.primaryActions.map((action, index) => (
            <button
              key={`op-${action.id}-${action.kind}-${index}`}
              type="button"
              onClick={() => void runAction(action, surface)}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-[10px] font-medium transition",
                index === 0
                  ? "border-resolve-accent/35 bg-resolve-accent/12 text-resolve-accent hover:bg-resolve-accent/18"
                  : "border-white/10 text-resolve-muted hover:border-white/20 hover:text-white",
              )}
            >
              {friendlyDiscoverActionLabel(action, connections)}
            </button>
          ))}
          {card.advancedActions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-resolve-muted-dim hover:text-white"
            >
              {showAdvanced ? "Less" : "Advanced"}
            </button>
          )}
          {showAdvanced &&
            card.advancedActions.map((action, index) => (
              <button
                key={`adv-${action.id}-${index}`}
                type="button"
                onClick={() => void runAction(action, surface)}
                className="rounded-md border border-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-resolve-muted-dim hover:text-white"
              >
                {friendlyDiscoverActionLabel(action, connections)}
              </button>
            ))}
        </div>
      )}
    </li>
  );
}

function actionForStage(
  action: DiscoverAction,
  stage: "extract" | "rule" | "settle",
): boolean {
  if (stage === "extract") {
    return action.kind === "connect_sensor" || action.kind === "analyze" || action.kind === "install";
  }
  if (stage === "rule") return action.kind === "create_program";
  return action.kind === "fund" || action.kind === "sponsor" || action.kind === "claim";
}
