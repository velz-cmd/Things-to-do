"use client";

import clsx from "clsx";
import { Target } from "lucide-react";
import { useMissionScope } from "@/lib/mission/mission-context";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import {
  MissionPipelineStepper,
  type MissionPipelineStep,
} from "@/components/resolve/mission-control/mission-pipeline-stepper";

const LOOP_PHASE_LABEL: Record<CapitalLoopPhase, string> = {
  observe: "Observe",
  understand: "Understand",
  design_capital: "Design",
  simulate: "Simulate",
  approve: "Approve",
  execute: "Execute",
  measure: "Measure",
  learn: "Learn",
};

function pipelineStep(loopPhase: CapitalLoopPhase, blueprintActive: boolean): MissionPipelineStep {
  if (!blueprintActive) return "signal";
  if (loopPhase === "simulate" || loopPhase === "approve") return loopPhase === "approve" ? "authorize" : "simulate";
  if (loopPhase === "execute" || loopPhase === "measure") return "authorize";
  return "blueprint";
}

/** Sticky mission objective — command deck header. */
export function MissionObjectiveBar({
  objective,
  loopPhase = "observe",
  blueprintActive = false,
  simulated = false,
}: {
  objective: string;
  loopPhase?: CapitalLoopPhase;
  blueprintActive?: boolean;
  simulated?: boolean;
}) {
  const { scope } = useMissionScope();
  const step = pipelineStep(loopPhase, blueprintActive);

  return (
    <div className="shrink-0 border-b border-resolve-border/60 bg-[#0a0f18]/85 px-4 py-3 backdrop-blur-md lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-400/20">
            <Target className="h-4 w-4 text-sky-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Active mission
            </p>
            <p className="truncate text-sm font-medium text-white">{objective}</p>
          </div>
        </div>

        <MissionPipelineStepper
          activeStep={step}
          simulated={simulated}
          className="hidden sm:flex"
        />

        <div className="flex flex-wrap items-center gap-2">
          {scope && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-resolve-muted">
              {scope.label}
            </span>
          )}
          <span
            className={clsx(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              blueprintActive
                ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
                : "border-white/10 bg-white/[0.04] text-resolve-muted",
            )}
          >
            {LOOP_PHASE_LABEL[loopPhase]}
          </span>
        </div>
      </div>
    </div>
  );
}
