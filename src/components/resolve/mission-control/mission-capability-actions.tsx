"use client";

import type { CapabilityAction } from "@/lib/mission/capabilities/types";

/** Context-emergent actions — no static Approve / Execute / Cancel. */
export function MissionCapabilityActions({
  actions,
  onAction,
  disabled,
}: {
  actions: CapabilityAction[];
  onAction: (action: CapabilityAction) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(a)}
          className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-left text-[12px] text-resolve-muted transition hover:border-resolve-accent/35 hover:text-white disabled:opacity-40"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
