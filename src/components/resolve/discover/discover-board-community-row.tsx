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
import { DiscoverActionBar } from "@/components/resolve/discover/discover-action-bar";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";

type DiscoverBoardCommunityRowProps = {
  item: Extract<DiscoverBoardItem, { boardKind: "community" }>;
  signedIn: boolean;
  role?: DiscoverRole;
};

/** Value graph unpaid-value row — state-aware primary CTA + real action buttons. */
export function DiscoverBoardCommunityRow({
  item,
  signedIn,
  role = "all",
}: DiscoverBoardCommunityRowProps) {
  const { runAction, wallet } = useDiscoverActions();
  const { registerVisibleAction } = useDiscoverActionAudit();
  const { state: connections } = useUserConnections();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const gap = useMemo(
    () => boardCommunityItemToGap(item, role, connections),
    [item, role, connections],
  );

  const spendableUsd = wallet.loaded ? wallet.spendableUsd : null;
  const installed = communityReadyForDiscover(item.communitySlug, connections);
  const profile = getCommunityValueProfile(item.communitySlug);

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

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              {installed ? "Source connected" : "Source needed"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-resolve-muted">
            {profile?.unpaidSubtitle ?? item.communityTagline}
          </p>
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
      </div>

      <DiscoverActionBar
        slots={card.actionSlots}
        advanced={card.advancedActions}
        connections={connections}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onAction={(action) => {
          const slot = card.actionSlots.find(
            (s) => s.action.id === action.id && s.action.kind === action.kind,
          );
          if (slot?.disabled) return;
          void runAction(action, "opportunity-board-explore");
        }}
      />
    </li>
  );
}
