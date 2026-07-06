"use client";

import { Target } from "lucide-react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { MISSION_AGENT_PIPELINE } from "@/lib/mission/mission-lane-copy";

/** Sticky mission objective — command deck identity. */
export function MissionObjectiveBar({ objective }: { objective: string }) {
  const { scope } = useMissionScope();

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-[#070b14]/80 px-4 py-2.5 backdrop-blur-md lg:px-8">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target className="h-3.5 w-3.5 shrink-0 text-resolve-accent" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Active mission
            </p>
            <p className="truncate text-sm font-medium text-white">{objective}</p>
          </div>
        </div>
        {scope && (
          <p className="text-[10px] text-resolve-muted">
            Scope · <span className="text-white/90">{scope.label}</span>
          </p>
        )}
      </div>
      <p className="mx-auto mt-1 max-w-2xl text-center text-[9px] text-resolve-muted-dim">
        {MISSION_AGENT_PIPELINE}
      </p>
    </div>
  );
}
