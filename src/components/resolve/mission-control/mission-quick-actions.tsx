"use client";

import { Sparkles } from "lucide-react";
import clsx from "clsx";
import type { MissionQuickAction } from "@/lib/mission/capabilities/types";
import { MISSION_STARTER_GROUPS } from "@/lib/mission/community/quick-actions";

/** Elsa-style pill actions — contextual shortcuts, not static nav. */
export function MissionQuickActions({
  actions,
  onSelect,
  disabled,
  variant = "default",
}: {
  actions: MissionQuickAction[];
  onSelect: (action: MissionQuickAction) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
}) {
  if (!actions.length) return null;

  return (
    <div className={clsx("flex flex-wrap gap-2", variant === "compact" ? "" : "mt-1")}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(a)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border transition disabled:opacity-40",
            variant === "compact" ?
              "border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-resolve-muted hover:border-white/20 hover:text-white"
            : "border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-[12px] text-white/90 hover:border-resolve-accent/40 hover:bg-white/[0.07]",
          )}
        >
          <Sparkles className="h-3 w-3 shrink-0 text-resolve-accent/80" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function MissionStarterPanel({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5 rounded-xl border border-white/[0.08] bg-[#070b12]/80 p-5">
      <div>
        <p className="text-sm font-medium text-white">Communities confusing you? Let&apos;s fund them.</p>
        <p className="mt-1 text-xs text-resolve-muted">
          Pick an action — RESOLVE routes observation, capital, and settlement automatically.
        </p>
      </div>
      {MISSION_STARTER_GROUPS.map((group) => (
        <div key={group.group}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            {group.group}
          </p>
          <MissionQuickActions
            actions={group.actions}
            onSelect={(a) => onSelect(a.prompt)}
            disabled={disabled}
            variant="compact"
          />
        </div>
      ))}
    </div>
  );
}
