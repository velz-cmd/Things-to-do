import { prisma } from "@/lib/db";
import { createProgram, getProgram, updateProgram } from "@/lib/communities/programs";
import type { ProgramRules } from "@/lib/communities/types";
import {
  type AutomationNotifyChannel,
  type AutomationRuleRecord,
  type AutomationTrigger,
  getTriggerDef,
} from "./types";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toRecord(row: {
  id: string;
  installId: string;
  programId: string | null;
  communitySlug: string;
  name: string;
  triggerEvent: string;
  authorizeUsd: number;
  notifyChannel: string;
  notifyTarget: string;
  enabled: boolean;
  lastFiredAt: Date | null;
  lastFiredMeta: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AutomationRuleRecord {
  return {
    id: row.id,
    installId: row.installId,
    programId: row.programId,
    communitySlug: row.communitySlug,
    name: row.name,
    triggerEvent: row.triggerEvent as AutomationTrigger,
    authorizeUsd: row.authorizeUsd,
    notifyChannel: row.notifyChannel as AutomationNotifyChannel,
    notifyTarget: row.notifyTarget,
    enabled: row.enabled,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    lastFiredMeta: parseJson(row.lastFiredMeta, null),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAutomationRules(
  userId: string,
  communitySlug: string,
): Promise<AutomationRuleRecord[]> {
  const rows = await prisma.resolveAutomationRule.findMany({
    where: { userId, communitySlug },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function getLiveAutomationRule(
  userId: string,
  communitySlug: string,
): Promise<AutomationRuleRecord | null> {
  const row = await prisma.resolveAutomationRule.findFirst({
    where: { userId, communitySlug, enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  return row ? toRecord(row) : null;
}

async function syncProgramPolicy(
  userId: string,
  programId: string,
  trigger: AutomationTrigger,
  authorizeUsd: number,
) {
  const def = getTriggerDef(trigger);
  const program = await getProgram(userId, programId);
  if (!program) return;

  const patch: Partial<ProgramRules> = {
    [def.ruleField]: authorizeUsd,
    connectorId: def.connectorId,
    eventType: def.eventType,
  };

  await updateProgram(userId, programId, {
    rules: patch,
    status: program.status === "draft" ? "active" : program.status,
  });
}

export async function createAutomationRule(
  userId: string,
  communitySlug: string,
  input: {
    name?: string;
    triggerEvent: AutomationTrigger;
    authorizeUsd: number;
    notifyChannel: AutomationNotifyChannel;
    notifyTarget: string;
    programId?: string;
    enable?: boolean;
  },
): Promise<{ ok: true; rule: AutomationRuleRecord } | { ok: false; error: string }> {
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
  });
  if (!install) {
    return { ok: false, error: "Install RESOLVE on this community first" };
  }

  const def = getTriggerDef(input.triggerEvent);
  let programId = input.programId;

  if (!programId) {
    const created = await createProgram(userId, communitySlug, {
      templateId: def.programTemplateId,
      rules: { [def.ruleField]: input.authorizeUsd },
    });
    if (!created.ok) return { ok: false, error: created.error };
    programId = created.program.id;
  } else {
    await syncProgramPolicy(userId, programId, input.triggerEvent, input.authorizeUsd);
  }

  if (input.enable !== false) {
    await prisma.resolveAutomationRule.updateMany({
      where: { userId, communitySlug, enabled: true },
      data: { enabled: false },
    });
  }

  const row = await prisma.resolveAutomationRule.create({
    data: {
      userId,
      installId: install.id,
      programId,
      communitySlug,
      name: input.name ?? `${def.label} · $${input.authorizeUsd}`,
      triggerEvent: input.triggerEvent,
      authorizeUsd: input.authorizeUsd,
      notifyChannel: input.notifyChannel,
      notifyTarget: input.notifyTarget,
      enabled: input.enable !== false,
    },
  });

  return { ok: true, rule: toRecord(row) };
}

export async function updateAutomationRule(
  userId: string,
  ruleId: string,
  input: {
    enabled?: boolean;
    authorizeUsd?: number;
    notifyTarget?: string;
    notifyChannel?: AutomationNotifyChannel;
  },
): Promise<{ ok: true; rule: AutomationRuleRecord } | { ok: false; error: string }> {
  const existing = await prisma.resolveAutomationRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!existing) return { ok: false, error: "Rule not found" };

  if (input.enabled === true) {
    await prisma.resolveAutomationRule.updateMany({
      where: {
        userId,
        communitySlug: existing.communitySlug,
        enabled: true,
        NOT: { id: ruleId },
      },
      data: { enabled: false },
    });
  }

  if (input.authorizeUsd != null && existing.programId) {
    await syncProgramPolicy(
      userId,
      existing.programId,
      existing.triggerEvent as AutomationTrigger,
      input.authorizeUsd,
    );
  }

  const row = await prisma.resolveAutomationRule.update({
    where: { id: ruleId },
    data: {
      enabled: input.enabled,
      authorizeUsd: input.authorizeUsd,
      notifyTarget: input.notifyTarget,
      notifyChannel: input.notifyChannel,
    },
  });

  return { ok: true, rule: toRecord(row) };
}

export async function markRuleFired(
  ruleId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await prisma.resolveAutomationRule.update({
    where: { id: ruleId },
    data: {
      lastFiredAt: new Date(),
      lastFiredMeta: JSON.stringify(meta),
    },
  });
}

export async function findRulesForIngestEvent(input: {
  missionId: string;
  connectorId: string;
  eventType: string;
}): Promise<Array<{ rule: AutomationRuleRecord; userId: string }>> {
  const program = await prisma.resolveProgram.findFirst({
    where: { missionId: input.missionId },
    include: { install: true },
  });
  if (!program) return [];

  const rows = await prisma.resolveAutomationRule.findMany({
    where: {
      installId: program.installId,
      enabled: true,
    },
  });

  const def = rows
    .map((row) => ({ row, trigger: row.triggerEvent as AutomationTrigger }))
    .filter(({ trigger }) => {
      const t = getTriggerDef(trigger);
      return t.connectorId === input.connectorId && t.eventType === input.eventType;
    });

  return def.map(({ row }) => ({
    rule: toRecord(row),
    userId: row.userId,
  }));
}
