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
import {
  DiscoverSolveButton,
  solveLinksForGap,
} from "@/components/resolve/discover/discover-solve-button";
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
  rank?: number;
};

/** Funding board community row — state-aware primary CTA + real action buttons. */
export function DiscoverBoardCommunityRow({
  item,
  signedIn,
  role = "all",
  rank,
}: DiscoverBoardCommunityRowProps) {
  const { runAction, wallet } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const [desktopQuickOpen, setDesktopQuickOpen] = useState(false);
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false);

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
    () => [...card.actionSlots.map((s) => s.action), ...card.advancedActions],
    [card],
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

  const primarySlot = card.actionSlots.find((slot) => slot.variant === "primary");
  const secondarySlot = card.actionSlots.find((slot) => slot.variant === "secondary");
  const visibleSlot = primarySlot ?? secondarySlot;
  const desktopVisibleActionIds = new Set(
    [visibleSlot]
      .filter(Boolean)
      .map((slot) => `${slot!.action.id}-${slot!.action.kind}`),
  );
  const primaryActionId = visibleSlot ? `${visibleSlot.action.id}-${visibleSlot.action.kind}` : null;
  const allQuickItems = buildCardQuickActions({
    card,
    connections,
    onAction: handleAction,
    solve: null,
  });
  const desktopQuickItems = allQuickItems.filter((item) => !desktopVisibleActionIds.has(item.id));
  const mobileQuickItems = allQuickItems.filter((item) => item.id !== primaryActionId);
  const hasAnalysisAction = allVisible.some((a) => a.kind === "analyze");
  const solveLinks = solveLinksForGap(gap);
  if (!hasAnalysisAction) {
    desktopQuickItems.push({
      id: "mission-intel",
      label: solveLinks.intelLabel,
      href: solveLinks.intelHref,
    });
    mobileQuickItems.push(
      {
        id: "mission-fund",
        label: "Open in Mission",
        href: solveLinks.fundHref,
      },
      {
        id: "mission-intel",
        label: solveLinks.intelLabel,
        href: solveLinks.intelHref,
      },
    );
  }

  return (
    <li
      className={clsx(styles.communityRecord, styles.previewRecord, "group relative focus:outline-none focus-visible:rounded-lg focus-visible:ring-1 focus-visible:ring-resolve-accent/40")}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "." || e.key === " ") {
          e.preventDefault();
          if (window.matchMedia("(max-width: 639px)").matches) {
            setMobileQuickOpen(true);
          } else {
            setDesktopQuickOpen(true);
          }
        }
      }}
    >
      <div className={styles.communityMain}>
        <div className={styles.communityIdentity}>
          <DiscoverCommunityLogo gap={gap} className="!h-11 !w-11 !rounded-xl" />
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null && <span className="font-mono text-[9px] tabular-nums text-resolve-muted-dim">#{rank}</span>}
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
          <DiscoverCardNarrativeBlock narrative={card.narrative} compact />
          <DiscoverProofPipeline stages={card.pipeline} className="mt-2" />
          </div>
        </div>
        <div className={styles.communityActions}>
          <p className={styles.zoneLabel}>Actions</p>
          <div className={styles.communityActionRow}>
            <DiscoverActionBar
              slots={visibleSlot ? [visibleSlot] : []}
              advanced={[]}
              connections={connections}
              onAction={handleAction}
              primarySubtext={card.narrative.primarySubtext}
              showOverflowMenu={false}
              className={styles.compactActionBar}
            />
            {!hasAnalysisAction && <DiscoverSolveButton gap={gap} compact mode="mission" className="hidden sm:flex" />}
            <DiscoverQuickActions
              items={desktopQuickItems}
              open={desktopQuickOpen}
              onOpenChange={setDesktopQuickOpen}
              triggerClassName="max-sm:hidden"
            />
            <DiscoverQuickActions
              items={mobileQuickItems}
              open={mobileQuickOpen}
              onOpenChange={setMobileQuickOpen}
              triggerClassName="sm:hidden"
            />
          </div>
        </div>
      </div>
    </li>
  );
}
