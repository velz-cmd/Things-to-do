"use client";

import { Sparkles } from "lucide-react";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";

/** Context-emergent actions — Elsa-style pills with sparkle affordance. */
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
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        Next steps
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-left text-[12px] text-white/90 transition hover:border-resolve-accent/40 hover:bg-white/[0.07] disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-resolve-accent/80" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
