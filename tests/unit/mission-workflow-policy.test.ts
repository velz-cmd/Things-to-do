import { describe, expect, it } from "vitest";
import { allowedMissionOperations, type MissionWorkflowFacts } from "@/lib/mission/workflow-policy";

const base: MissionWorkflowFacts = {
  kind: "compare",
  cancelled: false,
  hasEvidence: false,
  hasClaimDecision: false,
  hasComparisonDecision: false,
  hasSimulation: false,
  hasBlueprint: false,
  approvalState: "none",
  hasHandoff: false,
};

describe("Mission workflow policy", () => {
  it("moves Compare through evidence, decision, simulation, Blueprint, approval, and handoff", () => {
    expect(allowedMissionOperations(base)).toContain("mission.collect_evidence");
    expect(allowedMissionOperations(base)).not.toContain("mission.compare_options");

    const evidence = { ...base, hasEvidence: true };
    expect(allowedMissionOperations(evidence)).toContain("mission.compare_options");
    expect(allowedMissionOperations(evidence)).not.toContain("mission.run_simulation");

    const compared = { ...evidence, hasComparisonDecision: true };
    expect(allowedMissionOperations(compared)).toContain("mission.run_simulation");

    const simulated = { ...compared, hasSimulation: true };
    expect(allowedMissionOperations(simulated)).toContain("mission.create_blueprint");

    const blueprint = { ...simulated, hasBlueprint: true };
    expect(allowedMissionOperations(blueprint)).toContain("mission.request_approval");

    const requested = { ...blueprint, approvalState: "requested" as const };
    expect(allowedMissionOperations(requested)).toContain("mission.approve_blueprint");

    const approved = { ...blueprint, approvalState: "approved" as const };
    expect(allowedMissionOperations(approved)).toContain("mission.handoff_communities");
    expect(allowedMissionOperations(approved)).toContain("mission.prepare_capital_review");
  });

  it("prevents operations on a cancelled mission except requirement revision", () => {
    const allowed = allowedMissionOperations({ ...base, cancelled: true });
    expect([...allowed]).toEqual(["mission.modify_requirements"]);
  });

  it("requires the matching decision operation for Verify", () => {
    const allowed = allowedMissionOperations({ ...base, kind: "verify", hasEvidence: true });
    expect(allowed).toContain("mission.verify_claim");
    expect(allowed).not.toContain("mission.compare_options");
  });
});
