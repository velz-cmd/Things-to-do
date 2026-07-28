import { describe, expect, it } from "vitest";
import { MISSION_ACTION_REGISTRY } from "@/lib/mission/actions/action-registry";
import {
  missionManifestSchema,
  missionOperationRequestSchema,
  registeredOperationTypes,
  resolveChatResponseSchema,
} from "@/lib/mission/structured-contract";

describe("Mission structured contract", () => {
  it("requires type-specific fields in the Mission manifest", () => {
    expect(missionManifestSchema.safeParse({
      kind: "verify",
      objective: "Verify release authorship from connected evidence.",
      sources: [],
      constraints: [],
    }).success).toBe(false);

    expect(missionManifestSchema.safeParse({
      kind: "compare",
      objective: "Compare two repositories for deployment safety.",
      options: ["owner/a", "owner/b"],
      criteria: ["repository health"],
      sources: [],
      constraints: [],
    }).success).toBe(true);
  });

  it("rejects arbitrary operation names and missing confirmations", () => {
    expect(missionOperationRequestSchema.safeParse({
      operationType: "mission.execute_anything",
      idempotencyKey: crypto.randomUUID(),
      payload: {},
    }).success).toBe(false);

    expect(missionOperationRequestSchema.safeParse({
      operationType: "mission.approve_blueprint",
      idempotencyKey: crypto.randomUUID(),
      payload: { blueprintVersion: 1 },
    }).success).toBe(false);
  });

  it("keeps every registered operation backed by one server definition", () => {
    expect(Object.keys(MISSION_ACTION_REGISTRY).sort()).toEqual([...registeredOperationTypes].sort());
    for (const operationType of registeredOperationTypes) {
      expect(MISSION_ACTION_REGISTRY[operationType].id).toBe(operationType);
    }
  });

  it("limits responses to three contextual actions", () => {
    const response = resolveChatResponseSchema.safeParse({
      message: {
        id: "response-1",
        role: "assistant",
        summary: "Evidence compiled.",
        createdAt: new Date().toISOString(),
      },
      suggestedActions: Array.from({ length: 4 }, (_, index) => ({
        id: `action-${index}`,
        operationType: "mission.collect_evidence",
        label: "Collect Evidence",
        variant: "primary",
        payload: {},
        requiresConfirmation: false,
        enabled: true,
      })),
    });
    expect(response.success).toBe(false);
  });

  it("validates decision and operation-failure cards as structured data", () => {
    const response = resolveChatResponseSchema.safeParse({
      message: {
        id: "response-2",
        role: "assistant",
        summary: "The operation needs recovery.",
        createdAt: new Date().toISOString(),
      },
      cards: [
        {
          id: "decision-1",
          type: "decision_summary",
          title: "Decision",
          recommendation: "Collect the missing repository evidence.",
          reasons: ["The current snapshot is incomplete."],
          confidenceLabel: "evidence-limited",
        },
        {
          id: "failure-1",
          type: "operation_failure",
          title: "Operation failed",
          operationType: "mission.collect_evidence",
          message: "The selected source is unavailable.",
          retryable: true,
          recoveryOperationType: "mission.collect_evidence",
        },
      ],
    });
    expect(response.success).toBe(true);
  });
});
