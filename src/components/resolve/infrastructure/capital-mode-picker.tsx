"use client";

import clsx from "clsx";
import type { CapitalMode } from "@/lib/economy/types";

type Props = {
  modes: CapitalMode[];
  selectedId?: CapitalMode["id"];
  onSelect?: (id: CapitalMode["id"]) => void;
};

export function CapitalModePicker({ modes, selectedId, onSelect }: Props) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
        Capital modes — why you fund
      </p>
      <p className="mt-1 text-xs text-resolve-muted">
        Not charity. Pick the return structure that matches your goal.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {modes.map((mode) => {
          const selected = selectedId === mode.id;
          return (
            <li key={mode.id}>
              <button
                type="button"
                onClick={() => onSelect?.(mode.id)}
                disabled={!onSelect}
                className={clsx(
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-black/20 hover:border-white/15",
                  !onSelect && "cursor-default",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{mode.label}</p>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[9px] font-medium uppercase",
                      mode.shipped
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300",
                    )}
                  >
                    {mode.shipped ? "Live" : "Preview"}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted">
                  {mode.funderGets}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
