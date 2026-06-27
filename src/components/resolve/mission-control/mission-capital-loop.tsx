"use client";

import clsx from "clsx";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import { CAPITAL_LOOP_PHASES } from "@/lib/mission/capital-os";

export function MissionCapitalLoop({
  activePhase,
  compact,
}: {
  activePhase: CapitalLoopPhase;
  compact?: boolean;
}) {
  const activeIdx = CAPITAL_LOOP_PHASES.findIndex((p) => p.id === activePhase);

  return (
    <div className={clsx("w-full", compact ? "px-0" : "")}>
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {CAPITAL_LOOP_PHASES.map((phase, i) => {
          const isActive = phase.id === activePhase;
          const isPast = i < activeIdx;
          return (
            <div key={phase.id} className="flex shrink-0 items-center">
              <div
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition",
                  isActive ?
                    "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30"
                  : isPast ?
                    "text-emerald-400/80"
                  : "text-resolve-muted-dim",
                )}
              >
                <span
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    isActive ? "bg-violet-400"
                    : isPast ? "bg-emerald-400"
                    : "bg-white/20",
                  )}
                />
                {!compact && <span>{phase.label}</span>}
              </div>
              {i < CAPITAL_LOOP_PHASES.length - 1 && (
                <div
                  className={clsx(
                    "mx-0.5 h-px w-3",
                    isPast ? "bg-emerald-500/40" : "bg-white/[0.08]",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
