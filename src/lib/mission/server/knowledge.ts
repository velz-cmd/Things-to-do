import { prisma } from "@/lib/db";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";

export type KnowledgeRecord = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  source: string | null;
  ecosystemId: string | null;
  missionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listKnowledge(userId: string, limit = 64): Promise<KnowledgeRecord[]> {
  const rows = await prisma.resolveKnowledgeEntry.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    summary: r.summary,
    source: r.source,
    ecosystemId: r.ecosystemId,
    missionId: r.missionId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createKnowledgeEntry(
  userId: string,
  input: {
    title: string;
    summary: string;
    kind?: string;
    source?: string;
    content?: Record<string, unknown>;
    ecosystemId?: string;
    missionId?: string;
  },
) {
  const row = await prisma.resolveKnowledgeEntry.create({
    data: {
      userId,
      title: input.title,
      summary: input.summary,
      kind: input.kind ?? "research",
      source: input.source,
      contentJson: input.content ? JSON.stringify(input.content) : null,
      ecosystemId: input.ecosystemId,
      missionId: input.missionId,
    },
  });
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    summary: row.summary,
    source: row.source,
    ecosystemId: row.ecosystemId,
    missionId: row.missionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertKnowledgeFromMission(input: {
  userId: string;
  missionId: string;
  title: string;
  summary: string;
  findings: MissionFinding[];
  ecosystemId?: string;
  capability?: string;
}) {
  if (!input.findings.length && !input.summary) return;
  const top = input.findings[0];
  const idSeed = `${input.missionId}-${top?.id ?? "summary"}`;
  const existing = await prisma.resolveKnowledgeEntry.findFirst({
    where: { userId: input.userId, missionId: input.missionId },
    orderBy: { updatedAt: "desc" },
  });

  const content = {
    capability: input.capability,
    findings: input.findings,
    capturedAt: new Date().toISOString(),
  };

  if (existing) {
    await prisma.resolveKnowledgeEntry.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        summary: top?.insight ?? input.summary,
        contentJson: JSON.stringify(content),
        kind: "mission",
        source: "mission_orchestrator",
      },
    });
    return;
  }

  await prisma.resolveKnowledgeEntry.create({
    data: {
      userId: input.userId,
      missionId: input.missionId,
      ecosystemId: input.ecosystemId,
      title: input.title,
      summary: top?.insight ?? input.summary,
      kind: "mission",
      source: "mission_orchestrator",
      contentJson: JSON.stringify(content),
    },
  });

  if (top) {
    await prisma.resolveKnowledgeEntry.create({
      data: {
        userId: input.userId,
        missionId: input.missionId,
        ecosystemId: input.ecosystemId,
        title: `${input.title} · ${top.title}`,
        summary: top.insight,
        kind: "decision",
        source: "finding",
        contentJson: JSON.stringify({ finding: top }),
      },
    });
  }
}
