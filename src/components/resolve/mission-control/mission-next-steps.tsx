"use client";

import type { ContextualAction } from "@/lib/mission/contextual-actions";

export function MissionNextSteps({
  actions,
  onSelect,
  disabled,
}: {
  actions: ContextualAction[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-4">
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Suggested next</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(a.prompt)}
            className="rounded-full border border-resolve-border/60 px-3 py-1.5 text-left text-[12px] text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
