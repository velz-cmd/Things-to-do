import { z } from "zod";

export const missionActionIds = [
  "mission.answer", "mission.investigate", "mission.verify_claim", "mission.compare_options",
  "mission.challenge_decision", "mission.trace_value", "mission.draft_policy", "mission.simulate_policy",
  "mission.compile_blueprint", "mission.purchase_signal", "mission.commission_specialist",
  "mission.approve_decision", "mission.send_to_communities", "mission.send_to_capital",
] as const;

export type MissionActionId = (typeof missionActionIds)[number];
export type MissionActionState = "completed" | "partially_completed" | "blocked" | "rejected";

const objectiveSchema = z.object({ objective: z.string().min(3).max(4000), claim: z.string().min(3).optional() });

export type MissionActionDefinition = {
  id: MissionActionId;
  label: string;
  outputType: string;
  inputSchema: typeof objectiveSchema;
  requiresEvidence?: boolean;
  handoff?: "/communities" | "/capital";
};

const definitions: MissionActionDefinition[] = [
  ["mission.answer", "Answer from evidence", "answer", true],
  ["mission.investigate", "Investigate objective", "evidence_bundle"],
  ["mission.verify_claim", "Verify claim", "claim_verification", true],
  ["mission.compare_options", "Compare options", "comparison", true],
  ["mission.challenge_decision", "Challenge decision", "counter_case", true],
  ["mission.trace_value", "Trace value", "value_lineage", true],
  ["mission.draft_policy", "Draft policy", "policy_draft", true],
  ["mission.simulate_policy", "Simulate policy", "simulation", true],
  ["mission.compile_blueprint", "Compile Blueprint", "funding_blueprint", true],
  ["mission.purchase_signal", "Purchase signal", "paid_signal"],
  ["mission.commission_specialist", "Commission specialist", "work_order"],
  ["mission.approve_decision", "Approve decision", "decision_packet", true],
  ["mission.send_to_communities", "Send to Communities", "handoff", true, "/communities"],
  ["mission.send_to_capital", "Send to Capital", "handoff", true, "/capital"],
].map(([id, label, outputType, requiresEvidence, handoff]) => ({ id, label, outputType, inputSchema: objectiveSchema, requiresEvidence, handoff })) as MissionActionDefinition[];

export const MISSION_ACTION_REGISTRY = Object.fromEntries(definitions.map((definition) => [definition.id, definition])) as Record<MissionActionId, MissionActionDefinition>;

export function getMissionAction(id: string) {
  return MISSION_ACTION_REGISTRY[id as MissionActionId] ?? null;
}
