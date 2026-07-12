"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverActionSlot } from "@/lib/discover/discover-opportunity-state";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

type DiscoverActionBarProps = {
  slots: DiscoverActionSlot[];
  advanced?: DiscoverAction[];
  connections: UserConnectionState | null | undefined;
  onAction: (action: DiscoverAction) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  /** Extra CTA rendered alongside primary/secondary — e.g. "Solve with AI". */
  trailing?: ReactNode;
  primarySubtext?: string;
  className?: string;
};

/** Real action buttons — primary CTA + secondary, not hashtag pills. */
export function DiscoverActionBar({
  slots,
  advanced = [],
  connections,
  onAction,
  showAdvanced,
  onToggleAdvanced,
  trailing,
  primarySubtext,
  className,
}: DiscoverActionBarProps) {
  const primary = slots.find((s) => s.variant === "primary");
  const primaryLabel = primary ? normalizeLabel(friendlyDiscoverActionLabel(primary.action, connections)) : null;
  const secondary = dedupeSlotsByLabel(slots.filter((s) => s.variant === "secondary"), connections)
    .filter((s) => normalizeLabel(friendlyDiscoverActionLabel(s.action, connections)) !== primaryLabel)
    .slice(0, 3);
  const visibleLabels = new Set(
    [primary, ...secondary]
      .filter(Boolean)
      .map((s) => normalizeLabel(friendlyDiscoverActionLabel(s!.action, connections))),
  );
  const advancedActions = dedupeActionsByLabel(advanced, connections).filter(
    (a) => !visibleLabels.has(normalizeLabel(friendlyDiscoverActionLabel(a, connections))),
  );

  if (!primary && secondary.length === 0 && advancedActions.length === 0 && !trailing) {
    return null;
  }

  return (
    <div className={clsx("mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {primary && (
        <ActionButton
          slot={primary}
          connections={connections}
          subtext={primarySubtext}
          onClick={() => onAction(primary.action)}
        />
      )}
      {secondary.map((slot) => (
        <ActionButton
          key={`${slot.action.id}-${slot.action.kind}`}
          slot={slot}
          connections={connections}
          onClick={() => onAction(slot.action)}
        />
      ))}
      {trailing}
      {advancedActions.length > 0 && onToggleAdvanced && (
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="text-[11px] font-medium text-resolve-muted-dim hover:text-white"
        >
          {showAdvanced ? "Less" : "Advanced"}
        </button>
      )}
      {showAdvanced &&
        advancedActions.map((action, index) => (
          <button
            key={`adv-${action.id}-${index}`}
            type="button"
            onClick={() => onAction(action)}
            className="discover-action-btn discover-action-btn--secondary text-[11px]"
          >
            {friendlyDiscoverActionLabel(action, connections)}
          </button>
        ))}
    </div>
  );
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeSlotsByLabel(
  slots: DiscoverActionSlot[],
  connections: UserConnectionState | null | undefined,
): DiscoverActionSlot[] {
  const seen = new Set<string>();
  const out: DiscoverActionSlot[] = [];
  for (const slot of slots) {
    const key = normalizeLabel(friendlyDiscoverActionLabel(slot.action, connections));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
  }
  return out;
}

function dedupeActionsByLabel(
  actions: DiscoverAction[],
  connections: UserConnectionState | null | undefined,
): DiscoverAction[] {
  const seen = new Set<string>();
  const out: DiscoverAction[] = [];
  for (const action of actions) {
    const key = normalizeLabel(friendlyDiscoverActionLabel(action, connections));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function ActionButton({
  slot,
  connections,
  subtext,
  onClick,
}: {
  slot: DiscoverActionSlot;
  connections: UserConnectionState | null | undefined;
  subtext?: string;
  onClick: () => void;
}) {
  const label = friendlyDiscoverActionLabel(slot.action, connections);
  const isPrimary = slot.variant === "primary";

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        disabled={slot.disabled}
        title={slot.disabled ? slot.disabledReason : undefined}
        onClick={() => {
          if (slot.disabled) return;
          onClick();
        }}
        className={clsx(
          "discover-action-btn min-h-[34px] px-4 py-2 text-[12px] font-semibold",
          isPrimary ? "discover-action-btn--primary" : "discover-action-btn--secondary",
          `discover-action-btn--${slot.action.kind}`,
          slot.disabled && "cursor-not-allowed opacity-45",
        )}
      >
        {label}
      </button>
      {slot.disabled && slot.disabledReason ? (
        <span className="max-w-[260px] text-[10px] leading-snug text-amber-200/80">
          {slot.disabledReason}
        </span>
      ) : subtext ? (
        <span className="max-w-[260px] text-[10px] leading-snug text-resolve-muted">
          {subtext}
        </span>
      ) : null}
    </div>
  );
}
