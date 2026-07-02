"use client";

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
};

/** Real action buttons — primary CTA + secondary, not hashtag pills. */
export function DiscoverActionBar({
  slots,
  advanced = [],
  connections,
  onAction,
  showAdvanced,
  onToggleAdvanced,
}: DiscoverActionBarProps) {
  const primary = slots.find((s) => s.variant === "primary");
  const secondary = slots.filter((s) => s.variant === "secondary");

  if (!primary && secondary.length === 0 && advanced.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {primary && (
        <ActionButton
          slot={primary}
          connections={connections}
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
      {advanced.length > 0 && onToggleAdvanced && (
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="text-[11px] font-medium text-resolve-muted-dim hover:text-white"
        >
          {showAdvanced ? "Less" : "Advanced"}
        </button>
      )}
      {showAdvanced &&
        advanced.map((action, index) => (
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

function ActionButton({
  slot,
  connections,
  onClick,
}: {
  slot: DiscoverActionSlot;
  connections: UserConnectionState | null | undefined;
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
      {slot.disabled && slot.disabledReason && (
        <span className="text-[10px] text-amber-200/80">{slot.disabledReason}</span>
      )}
    </div>
  );
}
