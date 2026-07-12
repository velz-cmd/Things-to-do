"use client";

import { Bot, CircleDollarSign, Sparkles, UserRound } from "lucide-react";
import clsx from "clsx";
import type { CapitalLoopPhase, OperatingMode } from "@/lib/mission/capital-os";
import { MissionPipelineStepper } from "@/components/resolve/mission-control/mission-pipeline-stepper";

const ROLE_LABELS: Record<OperatingMode, string> = {
  founder: "Operator",
  dao: "Funder",
  maintainer: "Creator",
  creator: "Creator",
  research: "Agent",
  community_manager: "Operator",
};

function pipelineStep(loopPhase: CapitalLoopPhase, hasBlueprint: boolean, simulated: boolean) {
  if (simulated || loopPhase === "approve" || loopPhase === "execute" || loopPhase === "measure") {
    return "authorize" as const;
  }
  if (loopPhase === "simulate") return "simulate" as const;
  if (hasBlueprint || loopPhase === "design_capital") return "blueprint" as const;
  return "signal" as const;
}

export function MissionWorkspaceHeader({
  operatingMode,
  loopPhase,
  hasBlueprint,
  simulated,
  objective,
}: {
  operatingMode: OperatingMode;
  loopPhase: CapitalLoopPhase;
  hasBlueprint: boolean;
  simulated: boolean;
  objective?: string | null;
}) {
  const role = ROLE_LABELS[operatingMode];
  const RoleIcon = role === "Creator" ? UserRound : role === "Agent" ? Bot : CircleDollarSign;

  return (
    <header className="mission-command-header">
      <div className="mission-command-header__identity">
        <span className="mission-command-header__mark" aria-hidden>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="mission-command-header__title">MISSION</p>
            <span className="mission-role-badge">
              <RoleIcon className="h-3 w-3" aria-hidden />
              {role}
            </span>
          </div>
          <p className={clsx("mission-command-header__tagline", objective && "truncate")}>
            {objective ?? "Turn verified signals into capital decisions."}
          </p>
        </div>
      </div>
      <MissionPipelineStepper
        activeStep={pipelineStep(loopPhase, hasBlueprint, simulated)}
        simulated={simulated}
        className="mission-command-header__pipeline"
      />
    </header>
  );
}
