import type { MissionKind, RegisteredOperationType } from "@/lib/mission/structured-contract";

export type MissionWorkflowFacts = {
  kind: MissionKind;
  cancelled: boolean;
  hasEvidence: boolean;
  hasClaimDecision: boolean;
  hasComparisonDecision: boolean;
  hasSimulation: boolean;
  hasBlueprint: boolean;
  approvalState: "none" | "requested" | "approved";
  hasHandoff: boolean;
};

export function allowedMissionOperations(facts: MissionWorkflowFacts): Set<RegisteredOperationType> {
  const allowed = new Set<RegisteredOperationType>();
  allowed.add("mission.modify_requirements");
  if (facts.cancelled) return allowed;
  allowed.add("mission.cancel");
  if (!facts.hasBlueprint) allowed.add("mission.collect_evidence");

  if (!facts.hasEvidence) return allowed;
  if (facts.kind === "verify" && !facts.hasClaimDecision) {
    allowed.add("mission.verify_claim");
    return allowed;
  }
  if (facts.kind === "compare" && !facts.hasComparisonDecision) {
    allowed.add("mission.compare_options");
    return allowed;
  }
  if (!facts.hasSimulation) {
    allowed.add("mission.run_simulation");
    return allowed;
  }
  if (!facts.hasBlueprint) {
    allowed.add("mission.create_blueprint");
    return allowed;
  }
  if (facts.approvalState === "none") {
    allowed.add("mission.request_approval");
    return allowed;
  }
  if (facts.approvalState === "requested") {
    allowed.add("mission.approve_blueprint");
    return allowed;
  }
  if (!facts.hasHandoff) {
    allowed.add("mission.handoff_communities");
    allowed.add("mission.prepare_capital_review");
  }
  return allowed;
}
