"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Command } from "lucide-react";
import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverCardState } from "@/lib/discover/discover-card-state";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";

export type QuickAction = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
};

type DiscoverQuickActionsProps = {
  items: QuickAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra classes for the trigger — e.g. hover-reveal. */
  triggerClassName?: string;
  label?: string;
};

/**
 * Linear-style command popover for a card — every action reachable via hover
 * or keyboard, without expanding the "Advanced" row. Keyboard: ↑/↓ move,
 * Enter runs, Esc closes.
 */
export function DiscoverQuickActions({
  items,
  open,
  onOpenChange,
  triggerClassName,
  label = "Quick actions",
}: DiscoverQuickActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const firstEnabled = items.findIndex((i) => !i.disabled);

  useEffect(() => {
    if (open) {
      setActiveIndex(firstEnabled < 0 ? 0 : firstEnabled);
      menuRef.current?.focus();
    }
  }, [open, firstEnabled]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, onOpenChange]);

  if (!items.length) return null;

  function move(delta: number) {
    setActiveIndex((current) => {
      const n = items.length;
      let next = (current + delta + n) % n;
      for (let guard = 0; guard < n && items[next]?.disabled; guard += 1) {
        next = (next + delta + n) % n;
      }
      return next;
    });
  }

  function select(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    onOpenChange(false);
    item.onSelect();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === "Tab") {
      onOpenChange(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
        className={clsx(
          "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[11px] font-medium text-resolve-muted-dim transition hover:bg-white/[0.08] hover:text-white",
          triggerClassName,
        )}
      >
        <Command className="h-3.5 w-3.5" />
        More
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-lg border border-white/10 bg-[#0b0f16] p-1 shadow-xl shadow-black/50 focus:outline-none"
        >
          <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            {label}
          </p>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => {
                if (!item.disabled) setActiveIndex(index);
              }}
              onClick={() => select(index)}
              title={item.disabled ? item.disabledReason : undefined}
              className={clsx(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px]",
                item.disabled
                  ? "cursor-not-allowed text-resolve-muted-dim/60"
                  : index === activeIndex
                    ? "bg-white/[0.08] text-white"
                    : "text-resolve-muted hover:text-white",
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.hint && (
                <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-resolve-accent/80">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Flatten a card's primary/secondary/advanced actions (+ Solve) into quick actions. */
export function buildCardQuickActions(input: {
  card: DiscoverCardState;
  connections: UserConnectionState | null | undefined;
  onAction: (action: DiscoverAction) => void;
  solve?: { label: string; onSelect: () => void } | null;
}): QuickAction[] {
  const items: QuickAction[] = [];
  const seen = new Set<string>();

  function push(item: QuickAction) {
    const key = item.label.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  for (const slot of input.card.actionSlots) {
    push({
      id: `${slot.action.id}-${slot.action.kind}`,
      label: friendlyDiscoverActionLabel(slot.action, input.connections),
      hint: slot.variant === "primary" ? "Primary" : undefined,
      disabled: slot.disabled,
      disabledReason: slot.disabledReason,
      onSelect: () => input.onAction(slot.action),
    });
  }

  for (const action of input.card.advancedActions) {
    push({
      id: `adv-${action.id}-${action.kind}`,
      label: friendlyDiscoverActionLabel(action, input.connections),
      onSelect: () => input.onAction(action),
    });
  }

  if (input.solve) {
    push({
      id: "solve-ai",
      label: input.solve.label,
      hint: "AI",
      onSelect: input.solve.onSelect,
    });
  }

  return items;
}
