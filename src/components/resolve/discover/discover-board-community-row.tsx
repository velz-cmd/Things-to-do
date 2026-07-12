"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { needTypeBadgeClass, needTypeLabel } from "@/lib/discover/need-types";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { boardCommunityItemToGap } from "@/lib/discover/board-item-to-gap";
import { deriveDiscoverCardState } from "@/lib/discover/discover-card-state";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { DiscoverProofPipeline } from "@/components/resolve/discover/discover-proof-pipeline";
import { DiscoverCardNarrativeBlock } from "@/components/resolve/discover/discover-card-narrative";
import { DiscoverActionBar } from "@/components/resolve/discover/discover-action-bar";
import { DiscoverCommunityLogo } from "@/components/resolve/discover/discover-community-logo";
import { DiscoverSolveButton } from "@/components/resolve/discover/discover-solve-button";
import {
  DiscoverQuickActions,
  buildCardQuickActions,
} from "@/components/resolve/discover/discover-quick-actions";
import type { DiscoverAction } from "@/lib/discover/types";
import styles from "./discover-workspace.module.css";

type DiscoverBoardCommunityRowProps = {
  item: Extract<DiscoverBoardItem, { boardKind: "community" }>;
  signedIn: boolean;
  role?: DiscoverRole;
};

/** Funding board community row — state-aware primary CTA + real action buttons. */
export function DiscoverBoardCommunityRow({
  item,
  signedIn,
  role = "all",
}: DiscoverBoardCommunityRowProps) {
  const { runAction, wallet } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const gap = useMemo(
    () => boardCommunityItemToGap(item, role, connections),
    [item, role, connections],
  );

  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;
  const installed = communityReadyForDiscover(item.communitySlug, connections);

  const card = useMemo(
    () =>
      deriveDiscoverCardState(gap, connections, "graph", role, "opportunity-board-explore", {
        signedIn,
        spendableUsd,
      }),
    [gap, connections, role, signedIn, spendableUsd],
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
      registerVisibleAction("opportunity-board-explore", action);
    }
  }, [allVisible, registerVisibleAction]);

  const handleAction = (action: DiscoverAction) => {
    const slot = card.actionSlots.find(
      (s) => s.action.id === action.id && s.action.kind === action.kind,
    );
    if (slot?.disabled) return;
    void runAction(action, "opportunity-board-explore");
  };

  const quickItems = buildCardQuickActions({
    card,
    connections,
    onAction: handleAction,
    solve: null,
  });
  const hasAnalysisAction = allVisible.some((a) => a.kind === "analyze");

  return (
    <li
      className={clsx(styles.communityRecord, "group relative focus:outline-none focus-visible:rounded-lg focus-visible:ring-1 focus-visible:ring-resolve-accent/40")}
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
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <DiscoverCommunityLogo gap={gap} />
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{card.title}</p>
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                needTypeBadgeClass(item.needType),
              )}
            >
              {needTypeLabel(item.needType)}
            </span>
            <span
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase",
                installed
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-200/90"
                  : "border-white/10 bg-white/[0.04] text-resolve-muted",
              )}
            >
              {installed ? "Proof connected" : "Connect proof source"}
            </span>
          </div>
          <DiscoverCardNarrativeBlock narrative={card.narrative} />
          <DiscoverProofPipeline stages={card.pipeline} className="mt-2" />
          </div>
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
        primarySubtext={card.narrative.primarySubtext}
        trailing={hasAnalysisAction ? null : <DiscoverSolveButton gap={gap} />}
        className={styles.recordActionBar}
      />
    </li>
  );
}
