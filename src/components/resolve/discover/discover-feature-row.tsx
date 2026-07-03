"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DiscoverAction, DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { deriveDiscoverCardState, type DiscoverCardLane } from "@/lib/discover/discover-card-state";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";
import { DiscoverCardNarrativeBlock } from "@/components/resolve/discover/discover-card-narrative";
import { DiscoverActionBar } from "@/components/resolve/discover/discover-action-bar";
import { DiscoverSolveButton } from "@/components/resolve/discover/discover-solve-button";
import {
  DiscoverQuickActions,
  buildCardQuickActions,
} from "@/components/resolve/discover/discover-quick-actions";
import { useDiscoverSolveOptional } from "@/components/resolve/discover/discover-solve-provider";
import { solveIntentForGap } from "@/lib/discover/solve-intents";

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
  const solve = useDiscoverSolveOptional();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;

  const card = useMemo(
    () =>
      deriveDiscoverCardState(gap, connections, lane, role, surface, {
        signedIn,
        spendableUsd,
      }),
    [gap, connections, lane, role, surface, signedIn, spendableUsd],
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

  const handleAction = (action: DiscoverAction) => {
    const slot = card.actionSlots.find(
      (s) => s.action.id === action.id && s.action.kind === action.kind,
    );
    if (slot?.disabled) return;
    void runAction(action, surface);
  };

  const quickItems = buildCardQuickActions({
    card,
    connections,
    onAction: handleAction,
    solve: solve
      ? {
          label: "Solve with AI",
          onSelect: () => solve.requestSolve(solveIntentForGap(gap)),
        }
      : null,
  });

  return (
    <li
      className="resolve-signal-service-row group relative px-1 py-3 first:pt-0 last:pb-0 focus:outline-none focus-visible:rounded-lg focus-visible:ring-1 focus-visible:ring-resolve-accent/40"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "." || e.key === " ") {
          e.preventDefault();
          setQuickOpen(true);
        }
      }}
    >
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

          <DiscoverCardNarrativeBlock narrative={card.narrative} />

          <DiscoverProofPipeline stages={card.pipeline} className="mt-2" />
        </div>

        <DiscoverQuickActions
          items={quickItems}
          open={quickOpen}
          onOpenChange={setQuickOpen}
          triggerClassName="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100"
        />
      </div>

      <DiscoverActionBar
        slots={card.actionSlots}
        advanced={card.advancedActions}
        connections={connections}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onAction={handleAction}
        trailing={<DiscoverSolveButton gap={gap} />}
      />
    </li>
  );
}
