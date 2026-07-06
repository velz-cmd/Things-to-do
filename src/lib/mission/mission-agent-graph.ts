import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { MissionPhase } from "@/lib/mission/phases";

export type MissionAgentStageId =
  | "research"
  | "evidence"
  | "attribution"
  | "policy"
  | "simulation"
  | "settlement";

export type MissionAgentStageStatus = "waiting" | "running" | "done";

export type MissionAgentStage = {
  id: MissionAgentStageId;
  label: string;
  agent: string;
  status: MissionAgentStageStatus;
  /** 0–100 for assembly-line fill */
  progress: number;
};

export const MISSION_AGENT_STAGES: ReadonlyArray<{
  id: MissionAgentStageId;
  label: string;
  agent: string;
}> = [
  { id: "research", label: "Research", agent: "Research Agent" },
  { id: "evidence", label: "Evidence", agent: "Evidence Agent" },
  { id: "attribution", label: "Attribution", agent: "Attribution Agent" },
  { id: "policy", label: "Policy", agent: "Policy Agent" },
  { id: "simulation", label: "Simulation", agent: "Simulation Agent" },
  { id: "settlement", label: "Settlement", agent: "Settlement Agent" },
] as const;

export type MissionTurnSignals = {
  role: string;
  brief?: unknown;
  report?: unknown;
  blueprint?: unknown;
  agentSignal?: unknown;
  findings?: unknown[];
  allocations?: unknown[];
  policy?: unknown;
};

function hasEvidence(turns: MissionTurnSignals[]): boolean {
  return turns.some(
    (t) =>
      t.role === "resolve" &&
      (Boolean(t.brief) ||
        Boolean(t.report) ||
        Boolean(t.findings?.length) ||
        Boolean(t.agentSignal)),
  );
}

function hasAttribution(turns: MissionTurnSignals[]): boolean {
  return turns.some(
    (t) => t.role === "resolve" && (Boolean(t.allocations?.length) || Boolean(t.blueprint)),
  );
}

function hasPolicy(turns: MissionTurnSignals[]): boolean {
  return turns.some((t) => t.role === "resolve" && (Boolean(t.policy) || Boolean(t.blueprint)));
}

function stageProgress(status: MissionAgentStageStatus): number {
  if (status === "done") return 100;
  if (status === "running") return 62;
  return 8;
}

/**
 * Derives the multi-agent capital assembly line from mission state.
 * Like GitHub Actions — each agent lights up as value moves through the loop.
 */
export function deriveMissionAgentGraph(input: {
  loading: boolean;
  thinkingComplete?: boolean;
  missionPhase: MissionPhase;
  loopPhase: CapitalLoopPhase;
  turns: MissionTurnSignals[];
  blueprintActive: boolean;
  simulated: boolean;
}): MissionAgentStage[] {
  const started = input.loading || input.turns.length > 0;
  const evidenceReady = hasEvidence(input.turns) || Boolean(input.thinkingComplete);
  const attributionReady = hasAttribution(input.turns);
  const policyReady = hasPolicy(input.turns);
  const simulationReady = input.simulated;
  const settlementReady =
    input.loopPhase === "execute" ||
    input.loopPhase === "measure" ||
    input.missionPhase === "execute";

  const researchDone = evidenceReady || (started && !input.loading);
  const evidenceDone = evidenceReady && !input.loading;
  const attributionDone = attributionReady;
  const policyDone = policyReady;
  const simulationDone = simulationReady;

  function status(
    done: boolean,
    running: boolean,
  ): MissionAgentStageStatus {
    if (done) return "done";
    if (running) return "running";
    return "waiting";
  }

  const researchRunning = started && !researchDone && input.loading;
  const evidenceRunning = input.loading && researchDone && !evidenceDone;
  const attributionRunning =
    !attributionDone &&
    evidenceDone &&
    (input.loading || input.missionPhase === "plan" || input.blueprintActive);
  const policyRunning =
    !policyDone && attributionDone && (input.blueprintActive || input.missionPhase === "plan");
  const simulationRunning =
    !simulationDone && policyDone && input.blueprintActive && !input.simulated;
  const settlementRunning =
    !settlementReady &&
    (simulationDone || input.loopPhase === "approve") &&
    (input.loopPhase === "approve" || input.missionPhase === "execute");

  const statuses: MissionAgentStageStatus[] = [
    status(researchDone, researchRunning),
    status(evidenceDone, evidenceRunning),
    status(attributionDone, attributionRunning),
    status(policyDone, policyRunning),
    status(simulationDone, simulationRunning),
    status(settlementReady, settlementRunning),
  ];

  return MISSION_AGENT_STAGES.map((stage, i) => ({
    ...stage,
    status: statuses[i] ?? "waiting",
    progress: stageProgress(statuses[i] ?? "waiting"),
  }));
}

export function missionGraphComplete(stages: MissionAgentStage[]): boolean {
  return stages.every((s) => s.status === "done");
}
