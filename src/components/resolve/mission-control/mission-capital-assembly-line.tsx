"use client";

import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import {
  deriveMissionAgentGraph,
  missionGraphComplete,
  type MissionAgentStage,
} from "@/lib/mission/mission-agent-graph";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionTurn } from "@/components/resolve/mission-control/mission-workspace";

function StageGlyph({ stage }: { stage: MissionAgentStage }) {
  if (stage.status === "done") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />;
  }
  if (stage.status === "running") {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" aria-hidden />;
  }
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/15"
      aria-hidden
    />
  );
}

function AssemblyBar({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div className="mission-assembly-bar" aria-hidden>
      <div
        className={clsx(
          "mission-assembly-bar__fill",
          active && "mission-assembly-bar__fill--active",
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function MissionCapitalAssemblyLine({
  loading,
  thinkingComplete,
  missionPhase,
  loopPhase,
  turns,
  blueprintActive,
  simulated,
  compact = false,
  className,
}: {
  loading: boolean;
  thinkingComplete?: boolean;
  missionPhase: MissionPhase;
  loopPhase: CapitalLoopPhase;
  turns: MissionTurn[];
  blueprintActive: boolean;
  simulated: boolean;
  compact?: boolean;
  className?: string;
}) {
  const stages = deriveMissionAgentGraph({
    loading,
    thinkingComplete,
    missionPhase,
    loopPhase,
    turns,
    blueprintActive,
    simulated,
  });

  const visible = loading || turns.length > 0;
  if (!visible) return null;

  const complete = missionGraphComplete(stages);

  return (
    <DiscoverCapitalCard
      accent="cyan"
      as="section"
      ariaLabel="Capital assembly line"
      className={clsx("mission-assembly-line", className)}
      hover={false}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/80">
            Capital assembly line
          </p>
          <p className="mt-0.5 text-xs text-resolve-muted">
            {complete
              ? "Mission complete — agents coordinated capital through Arc"
              : "Agent-to-agent capital coordination — workers, not chat"}
          </p>
        </div>
        {complete && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
            Mission complete
          </span>
        )}
      </div>

      <div
        className={clsx(
          "mt-4 grid gap-2",
          compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        )}
      >
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={clsx(
              "mission-assembly-stage",
              stage.status === "running" && "mission-assembly-stage--running",
              stage.status === "done" && "mission-assembly-stage--done",
            )}
          >
            <div className="flex items-center gap-1.5">
              <StageGlyph stage={stage} />
              <span className="truncate text-xs font-medium text-white/90">{stage.label}</span>
            </div>
            {!compact && (
              <p className="mt-0.5 truncate text-[10px] text-resolve-muted-dim">{stage.agent}</p>
            )}
            <AssemblyBar
              progress={stage.progress}
              active={stage.status === "running"}
            />
          </div>
        ))}
      </div>
    </DiscoverCapitalCard>
  );
}
