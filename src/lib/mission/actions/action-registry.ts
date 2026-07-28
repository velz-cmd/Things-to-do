import {
  registeredOperationTypeSchema,
  registeredOperationTypes,
  type RegisteredOperationType,
} from "@/lib/mission/structured-contract";

export { registeredOperationTypes as missionActionIds };
export type MissionActionId = RegisteredOperationType;

export type MissionActionDefinition = {
  id: RegisteredOperationType;
  label: string;
  description: string;
  risk: "read" | "write" | "handoff";
  requiresConfirmation: boolean;
  resultingArtifact?: string;
};

const definitions = [
  {
    id: "mission.collect_evidence",
    label: "Collect evidence",
    description: "Compile persisted evidence from the selected sources.",
    risk: "read",
    requiresConfirmation: false,
    resultingArtifact: "evidence",
  },
  {
    id: "mission.verify_claim",
    label: "Verify claim",
    description: "Test the mission claim against collected evidence.",
    risk: "read",
    requiresConfirmation: false,
    resultingArtifact: "claim",
  },
  {
    id: "mission.compare_options",
    label: "Compare options",
    description: "Score the declared options using the manifest criteria.",
    risk: "read",
    requiresConfirmation: false,
    resultingArtifact: "comparison",
  },
  {
    id: "mission.run_simulation",
    label: "Run simulation",
    description: "Apply explicit assumptions to the current decision.",
    risk: "read",
    requiresConfirmation: false,
    resultingArtifact: "simulation",
  },
  {
    id: "mission.create_blueprint",
    label: "Create Blueprint",
    description: "Compile the evidence and decision into a versioned draft.",
    risk: "write",
    requiresConfirmation: false,
    resultingArtifact: "blueprint",
  },
  {
    id: "mission.request_approval",
    label: "Request approval",
    description: "Freeze the current Blueprint version for review.",
    risk: "write",
    requiresConfirmation: false,
    resultingArtifact: "approval",
  },
  {
    id: "mission.approve_blueprint",
    label: "Approve Blueprint",
    description: "Explicitly approve the immutable Blueprint version.",
    risk: "write",
    requiresConfirmation: true,
    resultingArtifact: "approval",
  },
  {
    id: "mission.handoff_communities",
    label: "Hand off to Communities",
    description: "Create a persisted Communities handoff receipt.",
    risk: "handoff",
    requiresConfirmation: true,
    resultingArtifact: "handoff",
  },
  {
    id: "mission.prepare_capital_review",
    label: "Prepare for Capital review",
    description: "Create a review package without moving funds.",
    risk: "handoff",
    requiresConfirmation: true,
    resultingArtifact: "handoff",
  },
  {
    id: "mission.modify_requirements",
    label: "Modify requirements",
    description: "Create a new manifest version and invalidate downstream drafts.",
    risk: "write",
    requiresConfirmation: false,
    resultingArtifact: "manifest",
  },
  {
    id: "mission.cancel",
    label: "Cancel mission",
    description: "Cancel the workflow while preserving its audit history.",
    risk: "write",
    requiresConfirmation: true,
  },
] as const satisfies readonly MissionActionDefinition[];

export const MISSION_ACTION_REGISTRY = Object.fromEntries(
  definitions.map((definition) => [definition.id, definition]),
) as Record<RegisteredOperationType, MissionActionDefinition>;

export function getMissionAction(value: string): MissionActionDefinition | null {
  const parsed = registeredOperationTypeSchema.safeParse(value);
  return parsed.success ? MISSION_ACTION_REGISTRY[parsed.data] : null;
}

export function isRegisteredMissionOperation(value: string): value is RegisteredOperationType {
  return registeredOperationTypes.includes(value as RegisteredOperationType);
}
