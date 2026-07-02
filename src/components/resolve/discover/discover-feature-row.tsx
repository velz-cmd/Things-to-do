"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { deriveDiscoverCardState, type DiscoverCardLane } from "@/lib/discover/discover-card-state";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";
import { DiscoverActionBar } from "@/components/resolve/discover/discover-action-bar";

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
  signedIn,
  intent: _intent = "all",
  role = "all",
  rank,
  surface = "feature-row",
  lane = "gaps",
}: DiscoverFeatureRowProps) {
  const { runAction, wallet } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;

  const card = useMemo(
    () =>
      deriveDiscoverCardState(gap, connections, lane, role, surface, {
        signedIn,
        spendableUsd,
      }),
    [gap, connections, lane, role, surface, signedIn, spendableUsd],
  );

  const needed = formatDiscoverMoney(
    gap.amountNeededUsd,
    gap.amountVerified,
    gap.dataSource,
    gap.amountKind,
  );

  const allVisible = useMemo(
    () => [
      ...card.actionSlots.map((s) => s.action),
      ...(showAdvanced ? card.advancedActions : []),
    ],
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

          <DiscoverProofPipeline stages={card.pipeline} className="mt-2" />
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

      <DiscoverActionBar
        slots={card.actionSlots}
        advanced={card.advancedActions}
        connections={connections}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onAction={(action) => {
          const slot = card.actionSlots.find((s) => s.action.id === action.id);
          if (slot?.disabled) return;
          void runAction(action, surface);
        }}
      />
    </li>
  );
}
