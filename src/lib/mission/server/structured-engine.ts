import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MISSION_ACTION_REGISTRY } from "@/lib/mission/actions/action-registry";
import { createMission, getMission } from "@/lib/mission/server/missions";
import {
  missionArtifactPayloadSchema,
  missionManifestSchema,
  resolveChatResponseSchema,
  type EvidenceReference,
  type MissionArtifactPayload,
  type MissionManifest,
  type MissionOperationRequest,
  type RegisteredOperationType,
  type ResolveChatResponse,
  type ResolveResponseCard,
  type ResolveSuggestedAction,
} from "@/lib/mission/structured-contract";
import { stringifyTurnPayload } from "@/lib/mission/mission-turn-payload";
import { allowedMissionOperations } from "@/lib/mission/workflow-policy";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const repositorySnapshotSchema = z.object({
  fullName: z.string(),
  stars: z.number().default(0),
  forks: z.number().default(0),
  priority: z.enum(["critical", "high", "medium"]).default("medium"),
  headline: z.string().default(""),
  unfundedMaintainers: z.number().default(0),
  highImpactPrs: z.number().default(0),
  health: z.object({
    score: z.number().default(0),
    grade: z.enum(["A", "B", "C", "D", "F"]).default("F"),
    maintainerCount: z.number().default(0),
    fundingGapUsd: z.number().default(0),
    headline: z.string().default(""),
  }),
  activity: z.object({
    records: z.array(z.object({
      id: z.string(),
      title: z.string(),
      actor: z.string(),
      occurredAt: z.string(),
      sourceUrl: z.string(),
    })).default([]),
  }).optional(),
  dependencies: z.array(z.object({
    name: z.string(),
    sourceUrl: z.string(),
  })).default([]),
});

type Snapshot = z.infer<typeof repositorySnapshotSchema> & {
  snapshotId: string;
  fingerprint: string;
  observedAt: string;
};

type StoredArtifact = {
  id: string;
  kind: MissionArtifactPayload["kind"];
  status: string;
  version: number;
  operationId: string | null;
  sourceRefs: string[];
  payload: MissionArtifactPayload;
  createdAt: string;
  updatedAt: string;
};

export type StructuredMissionSnapshot = {
  mission: NonNullable<Awaited<ReturnType<typeof getMission>>>;
  manifest: MissionManifest;
  artifacts: StoredArtifact[];
  response: ResolveChatResponse;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function artifactRowsToStored(
  rows: Array<{
    id: string;
    kind: string;
    status: string;
    version: number;
    operationId: string | null;
    sourceRefs: string[];
    payload: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }>,
): StoredArtifact[] {
  return rows.flatMap((row) => {
    const parsed = missionArtifactPayloadSchema.safeParse(row.payload);
    if (!parsed.success || parsed.data.kind !== row.kind) return [];
    return [{
      id: row.id,
      kind: parsed.data.kind,
      status: row.status,
      version: row.version,
      operationId: row.operationId,
      sourceRefs: row.sourceRefs,
      payload: parsed.data,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }];
  });
}

function latestByKind(artifacts: StoredArtifact[]) {
  const latest = new Map<MissionArtifactPayload["kind"], StoredArtifact>();
  for (const artifact of artifacts) {
    if (artifact.status === "superseded") continue;
    const current = latest.get(artifact.kind);
    if (!current || artifact.version > current.version) latest.set(artifact.kind, artifact);
  }
  return latest;
}

async function nextArtifactVersion(missionId: string, kind: MissionArtifactPayload["kind"]) {
  const latest = await prisma.resolveMissionArtifact.findFirst({
    where: { missionId, kind },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

async function createArtifact(input: {
  missionId: string;
  payload: MissionArtifactPayload;
  status?: string;
  operationId?: string;
  sourceRefs?: string[];
}) {
  const version = await nextArtifactVersion(input.missionId, input.payload.kind);
  return prisma.resolveMissionArtifact.create({
    data: {
      missionId: input.missionId,
      kind: input.payload.kind,
      status: input.status ?? "completed",
      version,
      operationId: input.operationId,
      sourceRefs: input.sourceRefs ?? [],
      payload: json(input.payload),
    },
  });
}

async function loadSnapshots(manifest: MissionManifest): Promise<Snapshot[]> {
  const requested = new Set(
    manifest.sources
      .filter((source) => source.type !== "evidence")
      .map((source) => source.ref.toLowerCase()),
  );
  if (manifest.kind === "compare") {
    for (const option of manifest.options) {
      if (/^[\w.-]+\/[\w.-]+$/.test(option)) requested.add(option.toLowerCase());
    }
  }

  const rows = await prisma.discoverRepositorySnapshot.findMany({
    where: requested.size ? {
      fullName: { in: [...requested] },
    } : undefined,
    orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
    take: requested.size ? Math.min(20, requested.size * 3) : 3,
  });

  const unique = new Map<string, Snapshot>();
  for (const row of rows) {
    const parsed = repositorySnapshotSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    const key = parsed.data.fullName.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, {
        ...parsed.data,
        snapshotId: row.id,
        fingerprint: row.fingerprint,
        observedAt: row.observedAt.toISOString(),
      });
    }
  }
  return [...unique.values()];
}

function evidenceFromSnapshots(manifest: MissionManifest, snapshots: Snapshot[]) {
  const references: EvidenceReference[] = snapshots.map((snapshot) => ({
    id: snapshot.snapshotId,
    label: `${snapshot.fullName} repository snapshot`,
    sourceType: "github_snapshot",
    sourceUrl: `https://github.com/${snapshot.fullName}`,
    observedAt: snapshot.observedAt,
    contentHash: snapshot.fingerprint,
  }));
  const facts = snapshots.flatMap((snapshot) => [
    { label: `${snapshot.fullName} health`, value: `${snapshot.health.grade} (${snapshot.health.score}/100)`, sourceRef: snapshot.snapshotId },
    { label: `${snapshot.fullName} maintainers`, value: String(snapshot.health.maintainerCount), sourceRef: snapshot.snapshotId },
    { label: `${snapshot.fullName} funding gap`, value: `$${Math.round(snapshot.health.fundingGapUsd).toLocaleString()}`, sourceRef: snapshot.snapshotId },
    { label: `${snapshot.fullName} accepted activity`, value: String(snapshot.activity?.records.length ?? 0), sourceRef: snapshot.snapshotId },
    { label: `${snapshot.fullName} dependencies`, value: String(snapshot.dependencies.length), sourceRef: snapshot.snapshotId },
  ]);
  const requested = manifest.sources
    .filter((source) => source.type !== "evidence")
    .map((source) => source.ref.toLowerCase());
  const found = new Set(snapshots.map((snapshot) => snapshot.fullName.toLowerCase()));
  const missing = requested
    .filter((ref) => !found.has(ref))
    .map((ref) => `No persisted repository snapshot is available for ${ref}.`);
  if (!references.length) missing.push("No persisted evidence source is available for this mission.");
  return { references, facts, missing };
}

function comparisonFromEvidence(
  manifest: Extract<MissionManifest, { kind: "compare" }>,
  snapshots: Snapshot[],
) {
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.fullName.toLowerCase(), snapshot]));
  const options = manifest.options.map((label) => {
    const snapshot = snapshotMap.get(label.toLowerCase());
    if (!snapshot) {
      return {
        label,
        score: 0,
        findings: [],
        missingEvidence: ["A current persisted repository snapshot is required."],
      };
    }
    const score = Math.max(0, Math.min(100, Math.round(
      snapshot.health.score
      - Math.min(20, snapshot.health.fundingGapUsd / 5_000)
      + Math.min(10, snapshot.health.maintainerCount * 2),
    )));
    return {
      label,
      score,
      findings: [
        `Repository health is ${snapshot.health.grade} (${snapshot.health.score}/100).`,
        `${snapshot.health.maintainerCount} maintainers and ${snapshot.activity?.records.length ?? 0} accepted activity records were observed.`,
        `The measured funding gap is $${Math.round(snapshot.health.fundingGapUsd).toLocaleString()}.`,
      ],
      missingEvidence: snapshot.activity?.records.length ? [] : ["No accepted contribution activity was present in the snapshot."],
    };
  });
  const eligible = options.filter((option) => option.findings.length > 0);
  const recommended = eligible.sort((a, b) => b.score - a.score)[0] ?? null;
  return {
    criteria: manifest.criteria,
    options,
    recommendedOption: recommended?.label ?? null,
    reasons: recommended ? [
      `${recommended.label} has the strongest deterministic evidence score.`,
      "The score uses only persisted health, maintainer depth, activity, and funding-gap evidence.",
    ] : ["A recommendation is withheld until at least one option has persisted evidence."],
  };
}

function claimFromEvidence(
  manifest: Extract<MissionManifest, { kind: "verify" }>,
  evidence: ReturnType<typeof evidenceFromSnapshots>,
) {
  const normalized = manifest.claim.toLowerCase();
  const supportingEvidence = evidence.facts
    .filter((fact) => normalized.includes(fact.label.split(" ")[0]!.toLowerCase()))
    .map((fact) => `${fact.label}: ${fact.value}`);
  const missingEvidence = [...evidence.missing];
  if (!supportingEvidence.length) {
    missingEvidence.push("The connected repository evidence does not directly prove this claim.");
  }
  return {
    claim: manifest.claim,
    verdict: supportingEvidence.length > 0 && missingEvidence.length === 0
      ? "supported" as const
      : "insufficient" as const,
    supportingEvidence,
    contradictions: [] as string[],
    missingEvidence,
  };
}

function responseCards(latest: Map<MissionArtifactPayload["kind"], StoredArtifact>): ResolveResponseCard[] {
  const cards: ResolveResponseCard[] = [];
  const evidence = latest.get("evidence")?.payload;
  if (evidence?.kind === "evidence") {
    cards.push({
      id: `evidence-${latest.get("evidence")!.version}`,
      type: "evidence_summary",
      title: "Evidence coverage",
      collected: evidence.references.length,
      verified: evidence.references.length,
      missing: evidence.missing,
      references: evidence.references,
    });
    if (evidence.missing.length > 0) {
      cards.push({
        id: `missing-${latest.get("evidence")!.version}`,
        type: "missing_information",
        title: "Missing information",
        items: evidence.missing,
        recovery: evidence.references.length
          ? "Refresh the declared sources or revise the Mission requirements."
          : "Install or refresh GitHub repository access, capture a Discover snapshot, then retry evidence collection.",
      });
    }
    if (evidence.references.length === 0) {
      cards.push({
        id: `integration-${latest.get("evidence")!.version}`,
        type: "integration_required",
        title: "GitHub evidence required",
        provider: "github",
        reason: "No persisted repository snapshot is available for the declared source.",
        targetRoute: "/profile?section=connections&provider=github&returnTo=%2Fmission",
      });
    }
  }
  const claim = latest.get("claim")?.payload;
  if (claim?.kind === "claim") {
    cards.push({
      id: `claim-${latest.get("claim")!.version}`,
      type: "claim_verification",
      title: "Claim verification",
      claim: claim.claim,
      verdict: claim.verdict,
      supportingEvidence: claim.supportingEvidence,
      contradictions: claim.contradictions,
      missingEvidence: claim.missingEvidence,
    });
  }
  const comparison = latest.get("comparison")?.payload;
  if (comparison?.kind === "comparison") {
    cards.push({
      id: `comparison-${latest.get("comparison")!.version}`,
      type: "comparison",
      title: "Comparison result",
      ...comparison,
    });
  }
  const simulation = latest.get("simulation")?.payload;
  if (simulation?.kind === "simulation") {
    cards.push({
      id: `simulation-${latest.get("simulation")!.version}`,
      type: "simulation",
      title: "Decision simulation",
      ...simulation,
    });
  }
  const blueprint = latest.get("blueprint")?.payload;
  const approval = latest.get("approval")?.payload;
  if (blueprint?.kind === "blueprint") {
    const status = approval?.kind === "approval"
      ? approval.state === "approved" ? "approved" : "approval_requested"
      : "draft";
    cards.push({
      id: `blueprint-${latest.get("blueprint")!.version}`,
      type: "blueprint",
      title: blueprint.title,
      version: latest.get("blueprint")!.version,
      status,
      objective: blueprint.objective,
      decision: blueprint.decision,
      evidenceCount: blueprint.evidenceIds.length,
      contentHash: blueprint.contentHash,
    });
  }
  const handoff = latest.get("handoff")?.payload;
  if (handoff?.kind === "handoff") {
    cards.push({
      id: `handoff-${latest.get("handoff")!.version}`,
      type: "handoff",
      title: handoff.destination === "capital" ? "Capital review package" : "Communities handoff",
      destination: handoff.destination,
      status: "accepted",
      receiptId: handoff.receiptId,
      targetRoute: handoff.targetRoute,
    });
  }
  return cards.slice(-5);
}

function action(input: Omit<ResolveSuggestedAction, "id">): ResolveSuggestedAction {
  return { id: `${input.operationType}:${hash(input.payload).slice(0, 10)}`, ...input };
}

function suggestedActions(
  manifest: MissionManifest,
  latest: Map<MissionArtifactPayload["kind"], StoredArtifact>,
): ResolveSuggestedAction[] {
  const evidence = latest.get("evidence")?.payload;
  const claim = latest.get("claim")?.payload;
  const comparison = latest.get("comparison")?.payload;
  const simulation = latest.get("simulation")?.payload;
  const blueprint = latest.get("blueprint");
  const approval = latest.get("approval")?.payload;
  const handoff = latest.get("handoff")?.payload;
  const actions: ResolveSuggestedAction[] = [];

  if (!evidence) {
    actions.push(action({
      operationType: "mission.collect_evidence",
      label: "Collect Evidence",
      description: "Use persisted snapshots from the declared sources.",
      variant: "primary",
      payload: { sourceRefs: manifest.sources.map((source) => source.ref) },
      requiresConfirmation: false,
      enabled: true,
    }));
    actions.push(action({
      operationType: "mission.create_blueprint",
      label: "Create Blueprint",
      variant: "secondary",
      payload: {},
      requiresConfirmation: false,
      enabled: false,
      disabledReason: "Collect evidence and complete the decision step first.",
    }));
    actions.push(action({
      operationType: "mission.modify_requirements",
      label: "Modify Requirements",
      variant: "secondary",
      payload: { manifest },
      requiresConfirmation: false,
      enabled: true,
    }));
    return actions;
  }
  if (evidence.kind === "evidence" && evidence.references.length === 0) {
    actions.push(action({
      operationType: "mission.collect_evidence",
      label: "Retry Evidence",
      description: "Retry after repository access or a persisted snapshot is available.",
      variant: "primary",
      payload: { sourceRefs: manifest.sources.map((source) => source.ref) },
      requiresConfirmation: false,
      enabled: true,
    }));
    actions.push(action({
      operationType: "mission.create_blueprint",
      label: "Create Blueprint",
      variant: "secondary",
      payload: {},
      requiresConfirmation: false,
      enabled: false,
      disabledReason: "At least one persisted evidence source is required.",
    }));
    actions.push(action({
      operationType: "mission.modify_requirements",
      label: "Modify Requirements",
      variant: "secondary",
      payload: { manifest },
      requiresConfirmation: false,
      enabled: true,
    }));
    return actions;
  }

  if (manifest.kind === "verify" && !claim) {
    actions.push(action({
      operationType: "mission.verify_claim",
      label: "Verify Claim",
      variant: "primary",
      payload: { claim: manifest.claim },
      requiresConfirmation: false,
      enabled: true,
    }));
  } else if (manifest.kind === "compare" && !comparison) {
    actions.push(action({
      operationType: "mission.compare_options",
      label: "Compare Options",
      variant: "primary",
      payload: { options: manifest.options, criteria: manifest.criteria },
      requiresConfirmation: false,
      enabled: true,
    }));
  } else if (!simulation) {
    actions.push(action({
      operationType: "mission.run_simulation",
      label: "Run Simulation",
      description: "Test the current decision without taking an external action.",
      variant: "primary",
      payload: { assumptions: {} },
      requiresConfirmation: false,
      enabled: true,
    }));
  } else if (!blueprint) {
    actions.push(action({
      operationType: "mission.create_blueprint",
      label: "Create Blueprint",
      variant: "primary",
      payload: {},
      requiresConfirmation: false,
      enabled: true,
    }));
  } else if (!approval) {
    actions.push(action({
      operationType: "mission.request_approval",
      label: "Request Approval",
      variant: "primary",
      payload: {},
      requiresConfirmation: false,
      enabled: true,
    }));
  } else if (approval.kind === "approval" && approval.state === "requested") {
    actions.push(action({
      operationType: "mission.approve_blueprint",
      label: "Approve Blueprint",
      description: "Freeze this version. Later changes create a new version.",
      variant: "primary",
      payload: { blueprintVersion: approval.blueprintVersion },
      requiresConfirmation: true,
      enabled: true,
    }));
  } else if (approval.kind === "approval" && approval.state === "approved" && !handoff) {
    actions.push(action({
      operationType: "mission.handoff_communities",
      label: "Hand Off to Communities",
      variant: "primary",
      payload: { blueprintVersion: approval.blueprintVersion },
      requiresConfirmation: true,
      enabled: true,
      targetRoute: "/communities",
    }));
    actions.push(action({
      operationType: "mission.prepare_capital_review",
      label: "Prepare for Capital Review",
      description: "Creates a review package. No funds move.",
      variant: "secondary",
      payload: { blueprintVersion: approval.blueprintVersion },
      requiresConfirmation: true,
      enabled: true,
      targetRoute: "/capital",
    }));
  }

  if (!handoff && actions.length < 3) {
    actions.push(action({
      operationType: "mission.modify_requirements",
      label: "Modify Requirements",
      variant: "secondary",
      payload: { manifest },
      requiresConfirmation: false,
      enabled: true,
    }));
  }
  if (!handoff && actions.length < 3) {
    actions.push(action({
      operationType: "mission.cancel",
      label: "Cancel Mission",
      description: "Preserve the audit history and stop this workflow.",
      variant: "danger",
      payload: {},
      requiresConfirmation: true,
      enabled: true,
    }));
  }
  return actions.slice(0, 3);
}

function responseSummary(
  operationType: RegisteredOperationType | "mission.created",
  manifest: MissionManifest,
) {
  const summaries: Record<RegisteredOperationType | "mission.created", string> = {
    "mission.created": `${manifest.kind[0]!.toUpperCase()}${manifest.kind.slice(1)} mission created. Review the plan, then collect evidence.`,
    "mission.collect_evidence": "Evidence collection completed. Missing coverage remains visible.",
    "mission.verify_claim": "The claim was checked against the persisted evidence.",
    "mission.compare_options": "The declared options were compared using the same evidence criteria.",
    "mission.run_simulation": "The decision was simulated. No external action was taken.",
    "mission.create_blueprint": "A versioned Blueprint draft was created from the current evidence and decision.",
    "mission.request_approval": "The current Blueprint version is ready for explicit approval.",
    "mission.approve_blueprint": "The Blueprint version is approved and immutable.",
    "mission.handoff_communities": "The approved Blueprint was handed off to Communities.",
    "mission.prepare_capital_review": "A Capital review package was created. No funds were moved.",
    "mission.modify_requirements": "The mission requirements were updated in a new manifest version.",
    "mission.cancel": "The mission was cancelled. Its evidence and audit history were preserved.",
  };
  return summaries[operationType];
}

async function buildResponse(
  missionId: string,
  manifest: MissionManifest,
  currentOperation: RegisteredOperationType | "mission.created",
): Promise<ResolveChatResponse> {
  const artifacts = artifactRowsToStored(await prisma.resolveMissionArtifact.findMany({
    where: { missionId },
    orderBy: [{ createdAt: "asc" }, { version: "asc" }],
  }));
  const latest = latestByKind(artifacts);
  const evidence = latest.get("evidence")?.payload;
  const response = {
    message: {
      id: randomUUID(),
      role: "assistant" as const,
      summary: responseSummary(currentOperation, manifest),
      details: evidence?.kind === "evidence" && evidence.missing.length
        ? `${evidence.missing.length} evidence requirement${evidence.missing.length === 1 ? "" : "s"} remain unresolved.`
        : undefined,
      createdAt: new Date().toISOString(),
    },
    cards: responseCards(latest),
    suggestedActions: suggestedActions(manifest, latest),
    evidenceReferences: evidence?.kind === "evidence" ? evidence.references : [],
    workflowState: {
      missionId,
      stage: currentOperation === "mission.created" ? "planned" : currentOperation.replace("mission.", ""),
      status: currentOperation === "mission.cancel" ? "cancelled" : "active",
      currentOperation: currentOperation === "mission.created" ? undefined : currentOperation,
    },
  };
  return resolveChatResponseSchema.parse(response);
}

async function appendStructuredResponse(input: {
  missionId: string;
  userText?: string;
  response: ResolveChatResponse;
}) {
  const count = await prisma.resolveMissionTurn.count({ where: { missionId: input.missionId } });
  const data: Prisma.ResolveMissionTurnCreateManyInput[] = [];
  if (input.userText) {
    data.push({
      missionId: input.missionId,
      role: "user",
      text: input.userText,
      sortOrder: count,
    });
  }
  data.push({
    missionId: input.missionId,
    role: "resolve",
    text: input.response.message.summary,
    payloadJson: stringifyTurnPayload({ structuredResponse: input.response }),
    sortOrder: count + data.length,
  });
  await prisma.resolveMissionTurn.createMany({ data });
}

export async function createStructuredMission(userId: string, rawManifest: unknown) {
  const manifest = missionManifestSchema.parse(rawManifest);
  const mission = await createMission(userId, {
    title: manifest.objective.slice(0, 100),
  });
  await createArtifact({
    missionId: mission.id,
    payload: { kind: "manifest", manifest },
  });
  await createArtifact({
    missionId: mission.id,
    payload: {
      kind: "plan",
      steps: [
        { id: "evidence", label: "Collect declared evidence", status: "ready" },
        {
          id: "decision",
          label: manifest.kind === "verify" ? "Verify the claim" : manifest.kind === "compare" ? "Compare options" : "Synthesize findings",
          status: "pending",
          prerequisite: "Evidence collection",
        },
        { id: "simulate", label: "Run deterministic simulation", status: "pending", prerequisite: "Decision artifact" },
        { id: "blueprint", label: "Compile versioned Blueprint", status: "pending", prerequisite: "Simulation" },
        { id: "approval", label: "Request explicit approval", status: "pending", prerequisite: "Blueprint" },
        { id: "handoff", label: "Prepare Communities or Capital handoff", status: "pending", prerequisite: "Approved Blueprint" },
      ],
    },
  });
  await prisma.resolveMission.update({
    where: { id: mission.id },
    data: {
      scope: manifest.objective,
      status: "created",
      phase: "plan",
      capability: manifest.kind === "compare" ? "compare_ecosystems" : manifest.kind === "verify" ? "explain_evidence" : "research_ecosystem",
      metadataJson: JSON.stringify({ structured: true, kind: manifest.kind }),
    },
  });
  const response = await buildResponse(mission.id, manifest, "mission.created");
  await appendStructuredResponse({ missionId: mission.id, userText: manifest.objective, response });
  return getStructuredMission(userId, mission.id);
}

async function currentManifest(missionId: string): Promise<MissionManifest> {
  const row = await prisma.resolveMissionArtifact.findFirst({
    where: { missionId, kind: "manifest" },
    orderBy: { version: "desc" },
  });
  const parsed = missionArtifactPayloadSchema.safeParse(row?.payload);
  if (!parsed.success || parsed.data.kind !== "manifest") {
    throw new Error("Mission manifest is missing or invalid.");
  }
  return parsed.data.manifest;
}

function requireArtifact(
  latest: Map<MissionArtifactPayload["kind"], StoredArtifact>,
  kind: MissionArtifactPayload["kind"],
  reason: string,
) {
  const artifact = latest.get(kind);
  if (!artifact) throw new Error(reason);
  return artifact;
}

async function executeRegisteredOperation(
  userId: string,
  missionId: string,
  operationId: string,
  request: MissionOperationRequest,
  manifest: MissionManifest,
) {
  const artifacts = artifactRowsToStored(await prisma.resolveMissionArtifact.findMany({
    where: { missionId },
    orderBy: [{ createdAt: "asc" }, { version: "asc" }],
  }));
  const latest = latestByKind(artifacts);

  switch (request.operationType) {
    case "mission.collect_evidence": {
      const snapshots = await loadSnapshots(manifest);
      const evidence = evidenceFromSnapshots(manifest, snapshots);
      await createArtifact({
        missionId,
        operationId,
        payload: { kind: "evidence", ...evidence },
        status: evidence.references.length ? "completed" : "blocked",
        sourceRefs: evidence.references.map((reference) => reference.id),
      });
      return;
    }
    case "mission.verify_claim": {
      requireArtifact(latest, "evidence", "Collect evidence before verifying a claim.");
      if (manifest.kind !== "verify") throw new Error("This mission does not declare a claim.");
      const evidenceArtifact = latest.get("evidence")!.payload;
      if (evidenceArtifact.kind !== "evidence") throw new Error("Evidence artifact is invalid.");
      await createArtifact({
        missionId,
        operationId,
        payload: { kind: "claim", ...claimFromEvidence(manifest, evidenceArtifact) },
        status: "completed",
        sourceRefs: evidenceArtifact.references.map((reference) => reference.id),
      });
      return;
    }
    case "mission.compare_options": {
      requireArtifact(latest, "evidence", "Collect evidence before comparing options.");
      if (manifest.kind !== "compare") throw new Error("This mission does not declare comparison options.");
      const snapshots = await loadSnapshots(manifest);
      const comparison = comparisonFromEvidence(manifest, snapshots);
      await createArtifact({
        missionId,
        operationId,
        payload: { kind: "comparison", ...comparison },
        status: comparison.recommendedOption ? "completed" : "blocked",
        sourceRefs: latest.get("evidence")!.sourceRefs,
      });
      return;
    }
    case "mission.run_simulation": {
      const evidence = requireArtifact(latest, "evidence", "Collect evidence before running a simulation.");
      const decision = latest.get("comparison") ?? latest.get("claim") ?? evidence;
      const coverage = evidence.sourceRefs.length;
      const decisionBlocked =
        decision.payload.kind === "comparison" ? !decision.payload.recommendedOption
        : decision.payload.kind === "claim" ? decision.payload.verdict === "insufficient"
        : coverage === 0;
      await createArtifact({
        missionId,
        operationId,
        payload: {
          kind: "simulation",
          assumptions: request.payload.assumptions,
          outcomes: [
            { label: "Evidence sources", value: String(coverage), status: coverage ? "pass" : "fail" },
            { label: "Decision readiness", value: decisionBlocked ? "Needs review" : "Ready", status: decisionBlocked ? "warn" : "pass" },
            { label: "External side effects", value: "None", status: "pass" },
          ],
          blockers: decisionBlocked ? ["The decision has unresolved evidence requirements. Approval must account for them."] : [],
        },
        status: "completed",
        sourceRefs: evidence.sourceRefs,
      });
      return;
    }
    case "mission.create_blueprint": {
      const evidence = requireArtifact(latest, "evidence", "Collect evidence before creating a Blueprint.");
      const simulation = requireArtifact(latest, "simulation", "Run a simulation before creating a Blueprint.");
      const comparison = latest.get("comparison")?.payload;
      const claim = latest.get("claim")?.payload;
      const decision =
        comparison?.kind === "comparison" ? comparison.recommendedOption
          ? `Recommend ${comparison.recommendedOption}.`
          : "No recommendation until missing evidence is resolved."
        : claim?.kind === "claim" ? `Claim verdict: ${claim.verdict}.`
        : "Proceed using the collected evidence with unresolved gaps disclosed.";
      const version = await nextArtifactVersion(missionId, "blueprint");
      const blueprintValue = {
        title: request.payload.title ?? `${manifest.kind[0]!.toUpperCase()}${manifest.kind.slice(1)} decision Blueprint`,
        objective: manifest.objective,
        decision,
        evidenceIds: evidence.sourceRefs,
        simulationVersion: simulation.version,
      };
      const contentHash = hash({ ...blueprintValue, version });
      await prisma.$transaction([
        prisma.blueprint.create({
          data: {
            userId,
            missionId,
            version,
            status: "draft",
            objective: json({ text: manifest.objective, kind: manifest.kind }),
            evidenceIds: evidence.sourceRefs,
            payees: json([]),
            policy: json({ decision, constraints: manifest.constraints }),
            fundingRequirementUsdcMicro: BigInt(0),
            settlementPath: json({ kind: "review_only", externalExecution: false }),
            contentHash,
          },
        }),
        prisma.resolveMissionArtifact.create({
          data: {
            missionId,
            kind: "blueprint",
            status: "draft",
            version,
            operationId,
            sourceRefs: evidence.sourceRefs,
            payload: json({ kind: "blueprint", ...blueprintValue, contentHash }),
          },
        }),
      ]);
      return;
    }
    case "mission.request_approval": {
      const blueprint = requireArtifact(latest, "blueprint", "Create a Blueprint before requesting approval.");
      await createArtifact({
        missionId,
        operationId,
        payload: { kind: "approval", blueprintVersion: blueprint.version, state: "requested" },
        status: "requested",
        sourceRefs: blueprint.sourceRefs,
      });
      await prisma.blueprint.update({
        where: { missionId_version: { missionId, version: blueprint.version } },
        data: { status: "approval_requested" },
      });
      return;
    }
    case "mission.approve_blueprint": {
      const blueprint = requireArtifact(latest, "blueprint", "Create a Blueprint before approval.");
      const approval = requireArtifact(latest, "approval", "Request approval before approving a Blueprint.");
      if (approval.payload.kind !== "approval" || approval.payload.state !== "requested") {
        throw new Error("The Blueprint is not awaiting approval.");
      }
      if (request.payload.blueprintVersion !== blueprint.version || request.payload.blueprintVersion !== approval.payload.blueprintVersion) {
        throw new Error("The requested Blueprint version is stale.");
      }
      await createArtifact({
        missionId,
        operationId,
        payload: {
          kind: "approval",
          blueprintVersion: blueprint.version,
          state: "approved",
          approvedAt: new Date().toISOString(),
        },
        status: "approved",
        sourceRefs: blueprint.sourceRefs,
      });
      await prisma.blueprint.update({
        where: { missionId_version: { missionId, version: blueprint.version } },
        data: { status: "approved" },
      });
      return;
    }
    case "mission.handoff_communities":
    case "mission.prepare_capital_review": {
      const blueprint = requireArtifact(latest, "blueprint", "Create a Blueprint before handoff.");
      const approval = requireArtifact(latest, "approval", "Approve the Blueprint before handoff.");
      if (approval.payload.kind !== "approval" || approval.payload.state !== "approved") {
        throw new Error("Approve the Blueprint before handoff.");
      }
      if (request.payload.blueprintVersion !== blueprint.version || request.payload.blueprintVersion !== approval.payload.blueprintVersion) {
        throw new Error("The requested Blueprint version is stale.");
      }
      const destination = request.operationType === "mission.handoff_communities" ? "communities" as const : "capital" as const;
      const receiptId = randomUUID();
      const targetRoute = destination === "communities"
        ? `/communities?mission=${encodeURIComponent(missionId)}&blueprint=${blueprint.version}`
        : `/capital?mission=${encodeURIComponent(missionId)}&blueprint=${blueprint.version}&mode=review`;
      await createArtifact({
        missionId,
        operationId,
        payload: {
          kind: "handoff",
          destination,
          blueprintVersion: blueprint.version,
          receiptId,
          targetRoute,
        },
        status: "accepted",
        sourceRefs: blueprint.sourceRefs,
      });
      await prisma.operationalEvent.create({
        data: {
          eventType: `mission.handoff.${destination}`,
          aggregateType: "ResolveMission",
          aggregateId: missionId,
          userId,
          correlationId: operationId,
          idempotencyKey: `event:${request.idempotencyKey}`,
          payload: json({ receiptId, blueprintVersion: blueprint.version, targetRoute, externalExecution: false }),
        },
      });
      return;
    }
    case "mission.modify_requirements": {
      const nextManifest = missionManifestSchema.parse(request.payload.manifest);
      await prisma.resolveMissionArtifact.updateMany({
        where: {
          missionId,
          kind: { notIn: ["manifest", "plan"] },
          status: { not: "superseded" },
        },
        data: { status: "superseded" },
      });
      await prisma.blueprint.updateMany({
        where: { missionId, status: { not: "superseded" } },
        data: { status: "superseded" },
      });
      await createArtifact({
        missionId,
        operationId,
        payload: { kind: "manifest", manifest: nextManifest },
        status: "completed",
      });
      await prisma.resolveMission.update({
        where: { id: missionId },
        data: {
          scope: nextManifest.objective,
          title: nextManifest.objective.slice(0, 100),
          status: "created",
          metadataJson: JSON.stringify({ structured: true, kind: nextManifest.kind, requirementsChangedAt: new Date().toISOString() }),
        },
      });
      return;
    }
    case "mission.cancel": {
      await prisma.resolveMission.update({
        where: { id: missionId },
        data: { status: "cancelled", phase: "cancelled" },
      });
      return;
    }
  }
}

export async function runStructuredMissionOperation(input: {
  userId: string;
  missionId: string;
  request: MissionOperationRequest;
}) {
  const mission = await prisma.resolveMission.findFirst({
    where: { id: input.missionId, userId: input.userId },
    select: { id: true, status: true },
  });
  if (!mission) throw new Error("Mission not found.");
  if (mission.status === "cancelled" && input.request.operationType !== "mission.modify_requirements") {
    throw new Error("This mission is cancelled. Modify its requirements to create a new active version.");
  }
  const definition = MISSION_ACTION_REGISTRY[input.request.operationType];
  if (definition.requiresConfirmation && !("confirmation" in input.request.payload && input.request.payload.confirmation === true)) {
    throw new Error("Explicit confirmation is required.");
  }

  const existing = await prisma.actionRun.findUnique({
    where: { idempotencyKey: input.request.idempotencyKey },
  });
  if (existing) return getStructuredMission(input.userId, input.missionId);

  const manifest = await currentManifest(input.missionId);
  const currentArtifacts = artifactRowsToStored(await prisma.resolveMissionArtifact.findMany({
    where: { missionId: input.missionId },
    orderBy: [{ createdAt: "asc" }, { version: "asc" }],
  }));
  const currentLatest = latestByKind(currentArtifacts);
  const currentApproval = currentLatest.get("approval")?.payload;
  const allowed = allowedMissionOperations({
    kind: manifest.kind,
    cancelled: mission.status === "cancelled",
    hasEvidence: Boolean(currentLatest.get("evidence")?.sourceRefs.length),
    hasClaimDecision: currentLatest.has("claim"),
    hasComparisonDecision: currentLatest.has("comparison"),
    hasSimulation: currentLatest.has("simulation"),
    hasBlueprint: currentLatest.has("blueprint"),
    approvalState: currentApproval?.kind === "approval" ? currentApproval.state : "none",
    hasHandoff: currentLatest.has("handoff"),
  });
  if (!allowed.has(input.request.operationType)) {
    throw new Error("This operation is not valid in the current Mission state.");
  }
  const manifestArtifact = await prisma.resolveMissionArtifact.findFirst({
    where: { missionId: input.missionId, kind: "manifest" },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  if (input.request.expectedVersion && input.request.expectedVersion !== manifestArtifact?.version) {
    throw new Error("Mission requirements changed. Refresh before continuing.");
  }

  const operation = await prisma.actionRun.create({
    data: {
      userId: input.userId,
      actionId: input.request.operationType,
      aggregateType: "ResolveMission",
      aggregateId: input.missionId,
      idempotencyKey: input.request.idempotencyKey,
      state: "submitting",
      recommendationReason: definition.description,
      input: json(input.request),
    },
  });

  try {
    await executeRegisteredOperation(input.userId, input.missionId, operation.id, input.request, manifest);
    const nextManifest = input.request.operationType === "mission.modify_requirements"
      ? input.request.payload.manifest
      : manifest;
    const response = await buildResponse(input.missionId, nextManifest, input.request.operationType);
    await appendStructuredResponse({
      missionId: input.missionId,
      userText: definition.label,
      response,
    });
    await prisma.actionRun.update({
      where: { id: operation.id },
      data: {
        state: "completed",
        output: json({ responseId: response.message.id }),
        completedAt: new Date(),
      },
    });
    await prisma.resolveMission.update({
      where: { id: input.missionId },
      data: {
        updatedAt: new Date(),
        status: input.request.operationType === "mission.cancel" ? "cancelled" : "active",
        phase: response.workflowState?.stage,
      },
    });
    return getStructuredMission(input.userId, input.missionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission operation failed.";
    await prisma.actionRun.update({
      where: { id: operation.id },
      data: {
        state: "rejected",
        errorCode: "MISSION_OPERATION_REJECTED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    const current = await buildResponse(input.missionId, manifest, input.request.operationType);
    const failureResponse: ResolveChatResponse = {
      ...current,
      message: {
        id: randomUUID(),
        role: "assistant",
        summary: `${definition.label} could not be completed.`,
        details: message,
        createdAt: new Date().toISOString(),
      },
      cards: [
        {
          id: `failure-${operation.id}`,
          type: "operation_failure",
          title: "Operation failed",
          operationType: input.request.operationType,
          message,
          retryable: definition.risk === "read",
          recoveryOperationType: definition.risk === "read" ? input.request.operationType : undefined,
        },
        ...(current.cards ?? []).slice(0, 7),
      ],
    };
    await appendStructuredResponse({
      missionId: input.missionId,
      userText: definition.label,
      response: failureResponse,
    });
    await prisma.resolveMission.update({
      where: { id: input.missionId },
      data: {
        status: "failed",
        phase: failureResponse.workflowState?.stage,
        updatedAt: new Date(),
      },
    });
    return getStructuredMission(input.userId, input.missionId);
  }
}

export async function getStructuredMission(userId: string, missionId: string): Promise<StructuredMissionSnapshot> {
  const mission = await getMission(userId, missionId);
  if (!mission) throw new Error("Mission not found.");
  const artifacts = artifactRowsToStored(await prisma.resolveMissionArtifact.findMany({
    where: { missionId },
    orderBy: [{ createdAt: "asc" }, { version: "asc" }],
  }));
  const manifestArtifact = [...artifacts].reverse().find((artifact) => artifact.kind === "manifest");
  if (!manifestArtifact || manifestArtifact.payload.kind !== "manifest") {
    throw new Error("This legacy Mission does not have a structured manifest.");
  }
  const lastStructured = [...mission.turns].reverse()
    .map((turn) => turn.payload?.structuredResponse)
    .find((response): response is ResolveChatResponse => Boolean(response));
  const response = lastStructured ?? await buildResponse(missionId, manifestArtifact.payload.manifest, "mission.created");
  return {
    mission,
    manifest: manifestArtifact.payload.manifest,
    artifacts,
    response,
  };
}

export async function listStructuredMissions(userId: string) {
  const missions = await prisma.resolveMission.findMany({
    where: {
      userId,
      metadataJson: { contains: "\"structured\":true" },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      scope: true,
      status: true,
      phase: true,
      updatedAt: true,
      artifacts: {
        where: { kind: "manifest" },
        orderBy: { version: "desc" },
        take: 1,
        select: { payload: true, version: true },
      },
    },
  });
  return missions.flatMap((mission) => {
    const parsed = missionArtifactPayloadSchema.safeParse(mission.artifacts[0]?.payload);
    if (!parsed.success || parsed.data.kind !== "manifest") return [];
    return [{
      id: mission.id,
      title: mission.title,
      objective: mission.scope ?? parsed.data.manifest.objective,
      kind: parsed.data.manifest.kind,
      status: mission.status,
      stage: mission.phase,
      manifestVersion: mission.artifacts[0]!.version,
      updatedAt: mission.updatedAt.toISOString(),
    }];
  });
}
