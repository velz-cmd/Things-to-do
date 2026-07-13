import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getCommunityBySlug,
  PROGRAM_TEMPLATES,
  listProgramTemplatesForKind,
  type ProgramTemplateId,
} from "@/lib/communities/catalog";
import { DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD } from "@/lib/capital/pool-checkpoint-defaults";
import type { ProgramRecord, ProgramRules } from "./types";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function policyHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function persistProgramVersion(
  tx: Prisma.TransactionClient,
  input: {
    programId: string;
    version: number;
    userId: string;
    communitySlug: string;
    name: string;
    templateId: string;
    status: string;
    budgetUsd: number;
    rules: ProgramRules;
    eventType: "program.draft_created" | "program.policy_updated";
  },
) {
  const snapshot = {
    name: input.name,
    templateId: input.templateId,
    status: input.status,
    budgetUsd: input.budgetUsd,
    communitySlug: input.communitySlug,
    rules: input.rules,
  };
  const programVersion = await tx.programVersion.create({
    data: {
      programId: input.programId,
      version: input.version,
      status: input.status,
      snapshot: toJson(snapshot),
      createdBy: input.userId,
    },
  });
  const contentHash = policyHash(snapshot);
  await tx.policyVersion.create({
    data: {
      programVersionId: programVersion.id,
      version: 1,
      evidenceRule: toJson({ source: input.rules.connectorId ?? "configured_sources", eventType: input.rules.eventType ?? "verified_activity" }),
      eligibilityRule: toJson({ identity: "resolved", manualReview: false }),
      allocationRule: toJson(input.rules),
      settlementRule: toJson({ network: "eip155:5042002", asset: "USDC", humanAuthorization: true }),
      contentHash,
      createdBy: input.userId,
    },
  });
  await appendOperationalEventInTransaction(tx, {
    eventType: input.eventType,
    aggregateType: "program",
    aggregateId: input.programId,
    userId: input.userId,
    communitySlug: input.communitySlug,
    correlationId: `${input.programId}:v${input.version}`,
    idempotencyKey: `${input.eventType}:${input.programId}:v${input.version}`,
    payload: toJson({ programId: input.programId, programVersionId: programVersion.id, version: input.version, contentHash }),
  });
}

function toProgramRecord(
  row: {
    id: string;
    installId: string;
    templateId: string;
    name: string;
    status: string;
    budgetUsd: number;
    rulesJson: string;
    recipientsJson: string;
    missionId: string | null;
    lastDeployAt: Date | null;
    lastSettlementId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  communitySlug: string,
): ProgramRecord {
  return {
    id: row.id,
    installId: row.installId,
    communitySlug,
    templateId: row.templateId,
    name: row.name,
    status: row.status,
    budgetUsd: row.budgetUsd,
    rules: parseJson(row.rulesJson, {} as ProgramRules),
    recipients: parseJson(row.recipientsJson, []),
    missionId: row.missionId,
    lastDeployAt: row.lastDeployAt?.toISOString() ?? null,
    lastSettlementId: row.lastSettlementId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProgramsForCommunity(
  userId: string,
  communitySlug: string,
): Promise<ProgramRecord[]> {
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
    include: { programs: { orderBy: { createdAt: "asc" } } },
  });
  if (!install) return [];
  return install.programs.map((p) => toProgramRecord(p, communitySlug));
}

/** Best program to show pool state for a community card (active, funded, or matching template). */
export async function resolvePrimaryProgramForCommunity(
  userId: string,
  communitySlug: string,
  preferredTemplateId?: string,
): Promise<ProgramRecord | null> {
  const programs = await listProgramsForCommunity(userId, communitySlug);
  if (!programs.length) return null;

  const ranked = [...programs].sort((a, b) => {
    const score = (p: ProgramRecord) => {
      let s = 0;
      if (p.status === "active" || p.status === "deployed") s += 100;
      if (preferredTemplateId && p.templateId === preferredTemplateId) s += 50;
      s += Math.min(40, p.budgetUsd / 25);
      return s;
    };
    return score(b) - score(a) || b.updatedAt.localeCompare(a.updatedAt);
  });

  return ranked[0] ?? null;
}

/** Public pool card lookup — highest-budget active program for a community slug. */
export async function resolvePublicProgramForCommunity(
  communitySlug: string,
  preferredTemplateId?: string,
): Promise<ProgramRecord | null> {
  const baseWhere = {
    status: { in: ["active", "deployed"] },
    install: { communitySlug },
  };

  let rows = await prisma.resolveProgram.findMany({
    where: preferredTemplateId
      ? { ...baseWhere, templateId: preferredTemplateId }
      : baseWhere,
    include: { install: true },
    orderBy: [{ budgetUsd: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });

  if (!rows.length && preferredTemplateId) {
    rows = await prisma.resolveProgram.findMany({
      where: baseWhere,
      include: { install: true },
      orderBy: [{ budgetUsd: "desc" }, { updatedAt: "desc" }],
      take: 20,
    });
  }

  if (!rows.length) return null;

  const ranked = [...rows].sort((a, b) => {
    const score = (p: typeof rows[0]) => {
      let s = 0;
      if (preferredTemplateId && p.templateId === preferredTemplateId) s += 50;
      s += Math.min(50, p.budgetUsd / 10);
      return s;
    };
    return score(b) - score(a) || b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const pick = ranked[0];
  return pick ? toProgramRecord(pick, communitySlug) : null;
}

export async function getProgram(userId: string, programId: string) {
  const row = await prisma.resolveProgram.findFirst({
    where: { id: programId, userId },
    include: { install: true },
  });
  if (!row) return null;
  return toProgramRecord(row, row.install.communitySlug);
}

export async function createProgram(
  userId: string,
  communitySlug: string,
  input: {
    templateId?: ProgramTemplateId;
    name?: string;
    budgetUsd?: number;
    rules?: Partial<ProgramRules>;
  },
) {
  const community = getCommunityBySlug(communitySlug);
  if (!community) return { ok: false as const, error: "Community not found" };

  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
  });
  if (!install) {
    return { ok: false as const, error: "Install RESOLVE on this community first" };
  }

  const kindTemplates = listProgramTemplatesForKind(community.kind);
  const defaultTemplateId =
    kindTemplates[0]?.id ?? ("user-centric-royalties" satisfies ProgramTemplateId);
  const templateId = input.templateId ?? defaultTemplateId;
  const template = PROGRAM_TEMPLATES[templateId];
  if (!template) return { ok: false as const, error: "Unknown program template" };

  const recentDraft = await prisma.resolveProgram.findFirst({
    where: {
      userId,
      installId: install.id,
      templateId,
      status: "draft",
      createdAt: { gte: new Date(Date.now() - 120_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recentDraft) {
    return {
      ok: true as const,
      program: toProgramRecord(recentDraft, communitySlug),
      reused: true as const,
    };
  }

  const rules = {
    ...template.defaultRules,
    autoSettleCheckpoints: true,
    checkpointThresholdsUsd: DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD,
    ...input.rules,
  } as ProgramRules;
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.resolveProgram.create({
      data: {
        userId,
        installId: install.id,
        templateId,
        name: input.name ?? template.name,
        status: "draft",
        budgetUsd: input.budgetUsd ?? template.defaultBudgetUsd,
        rulesJson: JSON.stringify(rules),
        missionId: `program-${crypto.randomUUID().slice(0, 12)}`,
        metadataJson: JSON.stringify({ communitySlug }),
      },
    });
    await persistProgramVersion(tx, {
      programId: created.id,
      version: 1,
      userId,
      communitySlug,
      name: created.name,
      templateId: created.templateId,
      status: created.status,
      budgetUsd: created.budgetUsd,
      rules,
      eventType: "program.draft_created",
    });
    return created;
  });

  return { ok: true as const, program: toProgramRecord(row, communitySlug) };
}

export async function updateProgram(
  userId: string,
  programId: string,
  input: { name?: string; budgetUsd?: number; status?: string; rules?: Partial<ProgramRules> },
) {
  const existing = await prisma.resolveProgram.findFirst({
    where: { id: programId, userId },
    include: { install: true },
  });
  if (!existing) return { ok: false as const, error: "Program not found" };

  const rules = parseJson(existing.rulesJson, {} as ProgramRules);
  const nextRules = { ...rules, ...input.rules };
  const row = await prisma.$transaction(async (tx) => {
    const latest = await tx.programVersion.aggregate({
      where: { programId },
      _max: { version: true },
    });
    const updated = await tx.resolveProgram.update({
      where: { id: programId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.budgetUsd !== undefined ? { budgetUsd: input.budgetUsd } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.rules ? { rulesJson: JSON.stringify(nextRules) } : {}),
      },
    });
    await persistProgramVersion(tx, {
      programId,
      version: (latest._max.version ?? 0) + 1,
      userId,
      communitySlug: existing.install.communitySlug,
      name: updated.name,
      templateId: updated.templateId,
      status: updated.status,
      budgetUsd: updated.budgetUsd,
      rules: nextRules,
      eventType: "program.policy_updated",
    });
    return updated;
  });

  return {
    ok: true as const,
    program: toProgramRecord(row, existing.install.communitySlug),
  };
}

export async function getActiveProgramMissionIds(userId: string): Promise<
  Array<{ missionId: string; perPlayUsd: number; communitySlug: string }>
> {
  const installs = await prisma.resolveCommunityInstall.findMany({
    where: { userId, status: "active" },
    include: {
      programs: { where: { status: { in: ["active", "deployed"] } } },
    },
  });

  const out: Array<{ missionId: string; perPlayUsd: number; communitySlug: string }> = [];
  for (const install of installs) {
    for (const program of install.programs) {
      if (!program.missionId) continue;
      const rules = parseJson(program.rulesJson, {} as ProgramRules);
      out.push({
        missionId: program.missionId,
        perPlayUsd: rules.perPlayUsd ?? 0.0004,
        communitySlug: install.communitySlug,
      });
    }
  }
  return out;
}
