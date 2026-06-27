"use client";

import type { CapabilityAction } from "@/lib/mission/capabilities/types";

export function MissionNextSteps({
  actions,
  onSelect,
  disabled,
}: {
  actions: CapabilityAction[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-4">
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Next</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (a.href && a.kind === "navigate") {
                window.location.href = a.href;
                return;
              }
              onSelect(a.prompt);
            }}
            className="rounded-full border border-resolve-border/60 px-3 py-1.5 text-left text-[12px] text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
