"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  ArrowDownToLine,
  ExternalLink,
  FileCheck2,
  Layers3,
  Link2,
  MoreHorizontal,
  ScanSearch,
  Share2,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
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
  showOverflowMenu?: boolean;
  secondaryLimit?: number;
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
  showOverflowMenu = true,
  secondaryLimit = 1,
}: DiscoverActionBarProps) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const primary = slots.find((s) => s.variant === "primary");
  const primaryLabel = primary ? normalizeLabel(friendlyDiscoverActionLabel(primary.action, connections)) : null;
  const allSecondary = dedupeSlotsByLabel(slots.filter((s) => s.variant === "secondary"), connections)
    .filter((s) => normalizeLabel(friendlyDiscoverActionLabel(s.action, connections)) !== primaryLabel);
  const secondary = allSecondary.slice(0, secondaryLimit);
  const overflowSlots = allSecondary.slice(secondaryLimit);
  const visibleLabels = new Set(
    [primary, ...allSecondary]
      .filter(Boolean)
      .map((s) => normalizeLabel(friendlyDiscoverActionLabel(s!.action, connections))),
  );
  const advancedActions = dedupeActionsByLabel(advanced, connections).filter(
    (a) => !visibleLabels.has(normalizeLabel(friendlyDiscoverActionLabel(a, connections))),
  );
  const menuOpen = showAdvanced ?? internalMenuOpen;
  const setMenuOpen = useCallback((open: boolean) => {
    if (onToggleAdvanced) {
      if (open !== Boolean(showAdvanced)) onToggleAdvanced();
      return;
    }
    setInternalMenuOpen(open);
  }, [onToggleAdvanced, showAdvanced]);
  const hasDesktopOverflow = overflowSlots.length > 0 || advancedActions.length > 0;
  const hasOverflow = showOverflowMenu && (allSecondary.length > 0 || advancedActions.length > 0);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [menuOpen, setMenuOpen]);

  if (!primary && secondary.length === 0 && !hasOverflow && !trailing) {
    return null;
  }

  return (
    <div className={clsx("relative mt-3 flex flex-wrap items-start gap-2", className)}>
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
      {hasOverflow && (
        <div ref={menuRootRef} className={clsx("relative shrink-0", !hasDesktopOverflow && "sm:hidden")}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="discover-action-btn discover-action-btn--tertiary min-h-10 gap-1.5 px-2.5 text-[11px]"
          >
            <MoreHorizontal className="h-4 w-4" />
            More
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="More record actions"
              onKeyDown={(event) => {
                if (event.key === "Escape") setMenuOpen(false);
              }}
              className="absolute right-0 top-full z-30 mt-1 min-w-56 rounded-lg border border-white/10 bg-[#08111f] p-1.5 shadow-2xl shadow-black/50"
            >
              {secondary.map((slot) => (
                <MenuActionButton
                  key={`mobile-${slot.action.id}-${slot.action.kind}`}
                  action={slot.action}
                  disabled={slot.disabled}
                  disabledReason={slot.disabledReason}
                  connections={connections}
                  mobileOnly
                  onSelect={() => {
                    setMenuOpen(false);
                    if (!slot.disabled) onAction(slot.action);
                  }}
                />
              ))}
              {overflowSlots.map((slot) => (
                <MenuActionButton
                  key={`${slot.action.id}-${slot.action.kind}`}
                  action={slot.action}
                  disabled={slot.disabled}
                  disabledReason={slot.disabledReason}
                  connections={connections}
                  onSelect={() => {
                    setMenuOpen(false);
                    if (!slot.disabled) onAction(slot.action);
                  }}
                />
              ))}
              {advancedActions.map((action) => (
                <MenuActionButton
                  key={`advanced-${action.id}-${action.kind}`}
                  action={action}
                  connections={connections}
                  onSelect={() => {
                    setMenuOpen(false);
                    onAction(action);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
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
  const Icon = iconForAction(slot.action);

  return (
    <div className={clsx("record-action-control flex min-w-0 flex-col gap-0.5", isPrimary ? "record-action-primary-control" : "record-action-secondary-control")}>
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
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
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

function MenuActionButton({
  action,
  disabled = false,
  disabledReason,
  connections,
  onSelect,
  mobileOnly = false,
}: {
  action: DiscoverAction;
  disabled?: boolean;
  disabledReason?: string;
  connections: UserConnectionState | null | undefined;
  onSelect: () => void;
  mobileOnly?: boolean;
}) {
  const Icon = iconForAction(action);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onSelect}
      className={clsx(
        "min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[11px] transition",
        mobileOnly ? "hidden max-sm:flex" : "flex",
        disabled ? "cursor-not-allowed text-resolve-muted-dim/50" : "text-resolve-muted hover:bg-white/[0.07] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      <span>{friendlyDiscoverActionLabel(action, connections)}</span>
    </button>
  );
}

function iconForAction(action: DiscoverAction) {
  switch (action.kind) {
    case "fund":
    case "sponsor":
      return WalletCards;
    case "claim":
      return ArrowDownToLine;
    case "install":
    case "connect_sensor":
      return Link2;
    case "create_program":
    case "console":
      return Layers3;
    case "analyze":
      return ScanSearch;
    case "automate":
      return Zap;
    case "share":
      return Share2;
    case "open":
      return action.href?.includes("proof") ? FileCheck2 : ExternalLink;
    default:
      return Sparkles;
  }
}
