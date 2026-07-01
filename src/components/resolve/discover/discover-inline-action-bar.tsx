"use client";

import clsx from "clsx";
import type { DiscoverAction } from "@/lib/discover/types";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { actionExecutionTruth } from "@/lib/discover/discover-action-truth";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";

type DiscoverInlineActionBarProps = {
  actions: DiscoverAction[];
  signedIn: boolean;
  surface?: string;
  onAction?: (action: DiscoverAction) => void;
  className?: string;
};

export function DiscoverInlineActionBar({
  actions,
  signedIn: _signedIn,
  surface = "inline-actions",
  onAction,
  className,
}: DiscoverInlineActionBarProps) {
  const { runAction } = useDiscoverActions();
  const { state: connections } = useUserConnections();
  const tailored = tailorDiscoverActionsForUser(actions, connections);

  if (!tailored.length) return null;

  return (
    <div
      className={clsx(
        "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="toolbar"
      aria-label="Actions"
    >
      {tailored.map((action) => {
        const truth = actionExecutionTruth(action.kind);
        const primary = action.kind === "fund" || action.kind === "sponsor";
        return (
          <button
            key={action.id}
            type="button"
            title={truth.detail}
            onClick={() => {
              void runAction(action, surface);
              onAction?.(action);
            }}
            className={clsx(
              "discover-inline-action shrink-0",
              primary && "discover-inline-action--primary",
              truth.arcSettlement && "discover-inline-action--arc",
            )}
          >
            <span className="discover-inline-action__label">
              {friendlyDiscoverActionLabel(action, connections)}
            </span>
            <span className="discover-inline-action__badge">{truth.badge}</span>
          </button>
        );
      })}
    </div>
  );
}
