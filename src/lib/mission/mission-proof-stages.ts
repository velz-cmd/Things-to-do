import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { MissionPhase } from "@/lib/mission/phases";
import type { PipelineStageState } from "@/lib/discover/discover-card-state";

/** Mission-scoped proof pipeline — aligns Discover cards with Mission authorize flow. */
export function missionProofStages(input: {
  missionPhase: MissionPhase;
  loopPhase?: CapitalLoopPhase;
  hasAgentReceipt?: boolean;
  hasPool?: boolean;
  hasAllocation?: boolean;
}): PipelineStageState[] {
  const loop = input.loopPhase ?? "observe";
  const planReady = input.missionPhase === "plan" || Boolean(input.hasAllocation);
  const executeReady = input.missionPhase === "execute";
  const signalsReady = loop !== "observe" || Boolean(input.hasAgentReceipt);

  return [
    {
      id: "extract",
      label: "Observe",
      status: signalsReady ? "signals" : "waiting",
      done: signalsReady,
      active: loop === "observe" && !input.hasAgentReceipt,
    },
    {
      id: "rule",
      label: "Authorize",
      status: planReady ? "ledger" : input.hasAgentReceipt ? "proof" : "pending",
      done: planReady || executeReady,
      active: signalsReady && !planReady,
    },
    {
      id: "settle",
      label: "Settle",
      status: executeReady ? "Arc" : input.hasPool && planReady ? "pool ready" : "—",
      done: executeReady,
      active: planReady && !executeReady,
    },
  ];
}
