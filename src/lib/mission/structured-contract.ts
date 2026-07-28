import { z } from "zod";

export const missionKinds = ["investigate", "verify", "compare"] as const;
export const missionKindSchema = z.enum(missionKinds);
export type MissionKind = z.infer<typeof missionKindSchema>;

const sourceInputSchema = z.object({
  type: z.enum(["connected_repository", "public_repository", "evidence"]),
  ref: z.string().min(1).max(300),
  label: z.string().min(1).max(160).optional(),
});

const manifestBaseSchema = z.object({
  objective: z.string().trim().min(8).max(4000),
  constraints: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  sources: z.array(sourceInputSchema).max(12).default([]),
});

export const missionManifestSchema = z.discriminatedUnion("kind", [
  manifestBaseSchema.extend({
    kind: z.literal("investigate"),
  }),
  manifestBaseSchema.extend({
    kind: z.literal("verify"),
    claim: z.string().trim().min(5).max(2000),
  }),
  manifestBaseSchema.extend({
    kind: z.literal("compare"),
    options: z.array(z.string().trim().min(2).max(300)).min(2).max(4),
    criteria: z.array(z.string().trim().min(2).max(200)).min(1).max(8),
  }),
]);

export type MissionManifest = z.infer<typeof missionManifestSchema>;

export const registeredOperationTypes = [
  "mission.collect_evidence",
  "mission.verify_claim",
  "mission.compare_options",
  "mission.run_simulation",
  "mission.create_blueprint",
  "mission.request_approval",
  "mission.approve_blueprint",
  "mission.handoff_communities",
  "mission.prepare_capital_review",
  "mission.modify_requirements",
  "mission.cancel",
] as const;

export const registeredOperationTypeSchema = z.enum(registeredOperationTypes);
export type RegisteredOperationType = z.infer<typeof registeredOperationTypeSchema>;

const operationBase = {
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().positive().optional(),
};

export const missionOperationRequestSchema = z.discriminatedUnion("operationType", [
  z.object({
    ...operationBase,
    operationType: z.literal("mission.collect_evidence"),
    payload: z.object({ sourceRefs: z.array(z.string().min(1)).max(12).default([]) }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.verify_claim"),
    payload: z.object({ claim: z.string().trim().min(5).max(2000).optional() }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.compare_options"),
    payload: z.object({
      options: z.array(z.string().trim().min(2).max(300)).min(2).max(4).optional(),
      criteria: z.array(z.string().trim().min(2).max(200)).min(1).max(8).optional(),
    }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.run_simulation"),
    payload: z.object({
      assumptions: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.create_blueprint"),
    payload: z.object({ title: z.string().trim().min(3).max(200).optional() }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.request_approval"),
    payload: z.object({ note: z.string().trim().max(1000).optional() }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.approve_blueprint"),
    payload: z.object({
      confirmation: z.literal(true),
      blueprintVersion: z.number().int().positive(),
    }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.handoff_communities"),
    payload: z.object({
      confirmation: z.literal(true),
      blueprintVersion: z.number().int().positive(),
    }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.prepare_capital_review"),
    payload: z.object({
      confirmation: z.literal(true),
      blueprintVersion: z.number().int().positive(),
    }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.modify_requirements"),
    payload: z.object({ manifest: missionManifestSchema }),
  }),
  z.object({
    ...operationBase,
    operationType: z.literal("mission.cancel"),
    payload: z.object({ confirmation: z.literal(true) }),
  }),
]);

export type MissionOperationRequest = z.infer<typeof missionOperationRequestSchema>;

const evidenceReferenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  sourceType: z.enum(["github_snapshot", "github", "database", "user", "system"]),
  sourceUrl: z.string().url().optional(),
  observedAt: z.string().datetime(),
  contentHash: z.string().optional(),
});

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

const cardBase = {
  id: z.string(),
  title: z.string(),
};

export const resolveResponseCardSchema = z.discriminatedUnion("type", [
  z.object({
    ...cardBase,
    type: z.literal("decision_summary"),
    recommendation: z.string(),
    reasons: z.array(z.string()),
    confidenceLabel: z.enum(["evidence-limited", "supported", "strongly-supported"]),
  }),
  z.object({
    ...cardBase,
    type: z.literal("evidence_summary"),
    collected: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
    missing: z.array(z.string()),
    references: z.array(evidenceReferenceSchema),
  }),
  z.object({
    ...cardBase,
    type: z.literal("claim_verification"),
    claim: z.string(),
    verdict: z.enum(["supported", "contradicted", "insufficient"]),
    supportingEvidence: z.array(z.string()),
    contradictions: z.array(z.string()),
    missingEvidence: z.array(z.string()),
  }),
  z.object({
    ...cardBase,
    type: z.literal("comparison"),
    criteria: z.array(z.string()),
    options: z.array(z.object({
      label: z.string(),
      score: z.number(),
      findings: z.array(z.string()),
      missingEvidence: z.array(z.string()),
    })),
    recommendedOption: z.string().nullable(),
    reasons: z.array(z.string()),
  }),
  z.object({
    ...cardBase,
    type: z.literal("simulation"),
    assumptions: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    outcomes: z.array(z.object({ label: z.string(), value: z.string(), status: z.enum(["pass", "warn", "fail"]) })),
    blockers: z.array(z.string()),
  }),
  z.object({
    ...cardBase,
    type: z.literal("blueprint"),
    version: z.number().int().positive(),
    status: z.enum(["draft", "approval_requested", "approved"]),
    objective: z.string(),
    decision: z.string(),
    evidenceCount: z.number().int().nonnegative(),
    contentHash: z.string(),
  }),
  z.object({
    ...cardBase,
    type: z.literal("handoff"),
    destination: z.enum(["communities", "capital"]),
    status: z.enum(["prepared", "accepted"]),
    receiptId: z.string(),
    targetRoute: z.string(),
  }),
  z.object({
    ...cardBase,
    type: z.literal("missing_information"),
    items: z.array(z.string()),
    recovery: z.string(),
  }),
  z.object({
    ...cardBase,
    type: z.literal("integration_required"),
    provider: z.enum(["github"]),
    reason: z.string(),
    targetRoute: z.string(),
  }),
  z.object({
    ...cardBase,
    type: z.literal("operation_failure"),
    operationType: registeredOperationTypeSchema,
    message: z.string(),
    retryable: z.boolean(),
    recoveryOperationType: registeredOperationTypeSchema.optional(),
  }),
]);

export type ResolveResponseCard = z.infer<typeof resolveResponseCardSchema>;

export const resolveSuggestedActionSchema = z.object({
  id: z.string(),
  operationType: registeredOperationTypeSchema,
  label: z.string(),
  description: z.string().optional(),
  variant: z.enum(["primary", "secondary", "danger", "navigation"]),
  payload: z.record(z.string(), z.unknown()),
  requiresConfirmation: z.boolean(),
  enabled: z.boolean(),
  disabledReason: z.string().optional(),
  targetRoute: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type ResolveSuggestedAction = z.infer<typeof resolveSuggestedActionSchema>;

export const resolveChatResponseSchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.literal("assistant"),
    summary: z.string(),
    details: z.string().optional(),
    createdAt: z.string().datetime(),
  }),
  cards: z.array(resolveResponseCardSchema).max(8).optional(),
  suggestedActions: z.array(resolveSuggestedActionSchema).max(3).optional(),
  evidenceReferences: z.array(evidenceReferenceSchema).optional(),
  workflowState: z.object({
    missionId: z.string().optional(),
    stage: z.string().optional(),
    status: z.string().optional(),
    currentOperation: registeredOperationTypeSchema.optional(),
  }).optional(),
});

export type ResolveChatResponse = z.infer<typeof resolveChatResponseSchema>;

export const missionArtifactPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manifest"), manifest: missionManifestSchema }),
  z.object({
    kind: z.literal("plan"),
    steps: z.array(z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(["pending", "ready", "completed", "blocked"]),
      prerequisite: z.string().optional(),
    })),
  }),
  z.object({
    kind: z.literal("evidence"),
    references: z.array(evidenceReferenceSchema),
    facts: z.array(z.object({ label: z.string(), value: z.string(), sourceRef: z.string() })),
    missing: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("claim"),
    claim: z.string(),
    verdict: z.enum(["supported", "contradicted", "insufficient"]),
    supportingEvidence: z.array(z.string()),
    contradictions: z.array(z.string()),
    missingEvidence: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("comparison"),
    criteria: z.array(z.string()),
    options: z.array(z.object({
      label: z.string(),
      score: z.number(),
      findings: z.array(z.string()),
      missingEvidence: z.array(z.string()),
    })),
    recommendedOption: z.string().nullable(),
    reasons: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("simulation"),
    assumptions: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    outcomes: z.array(z.object({ label: z.string(), value: z.string(), status: z.enum(["pass", "warn", "fail"]) })),
    blockers: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("blueprint"),
    title: z.string(),
    objective: z.string(),
    decision: z.string(),
    evidenceIds: z.array(z.string()),
    simulationVersion: z.number().int().positive().optional(),
    contentHash: z.string(),
  }),
  z.object({
    kind: z.literal("approval"),
    blueprintVersion: z.number().int().positive(),
    state: z.enum(["requested", "approved"]),
    approvedAt: z.string().datetime().optional(),
  }),
  z.object({
    kind: z.literal("handoff"),
    destination: z.enum(["communities", "capital"]),
    blueprintVersion: z.number().int().positive(),
    receiptId: z.string(),
    targetRoute: z.string(),
  }),
]);

export type MissionArtifactPayload = z.infer<typeof missionArtifactPayloadSchema>;
