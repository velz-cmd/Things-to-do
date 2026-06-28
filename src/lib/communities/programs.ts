import { prisma } from "@/lib/db";
import {
  getCommunityBySlug,
  PROGRAM_TEMPLATES,
  listProgramTemplatesForKind,
  type ProgramTemplateId,
} from "@/lib/communities/catalog";
import type { ProgramRecord, ProgramRules } from "./types";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

  const row = await prisma.resolveProgram.create({
    data: {
      userId,
      installId: install.id,
      templateId,
      name: input.name ?? template.name,
      status: "draft",
      budgetUsd: input.budgetUsd ?? template.defaultBudgetUsd,
      rulesJson: JSON.stringify({ ...template.defaultRules, ...input.rules }),
      missionId: `program-${crypto.randomUUID().slice(0, 12)}`,
      metadataJson: JSON.stringify({ communitySlug }),
    },
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
  const row = await prisma.resolveProgram.update({
    where: { id: programId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.budgetUsd !== undefined ? { budgetUsd: input.budgetUsd } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.rules ? { rulesJson: JSON.stringify({ ...rules, ...input.rules }) } : {}),
    },
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
