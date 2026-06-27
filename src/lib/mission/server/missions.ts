import { prisma } from "@/lib/db";
import type { MissionStatus } from "@/lib/mission/state-machine";
import { canTransition, statusForCapabilityPhase } from "@/lib/mission/state-machine";
import type { CapabilityId } from "@/lib/mission/capabilities/types";
import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { MissionReport } from "@/lib/mission/mission-report";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { upsertKnowledgeFromMission } from "@/lib/mission/server/knowledge";

export type MissionRecord = {
  id: string;
  title: string;
  scope: string | null;
  status: MissionStatus;
  capability: string | null;
  phase: string | null;
  ecosystemId: string | null;
  findingCount: number;
  capitalUsd: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  turns: Array<{
    id: string;
    role: "user" | "resolve";
    text: string;
    phase?: string;
    capability?: string;
    findings?: MissionFinding[];
    actions?: CapabilityAction[];
    report?: MissionReport;
  }>;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toMissionRecord(
  row: Awaited<ReturnType<typeof prisma.resolveMission.findFirst>> & object,
  turns: Awaited<ReturnType<typeof prisma.resolveMissionTurn.findMany>>,
): MissionRecord {
  return {
    id: row.id,
    title: row.title,
    scope: row.scope,
    status: row.status as MissionStatus,
    capability: row.capability,
    phase: row.phase,
    ecosystemId: row.ecosystemId,
    findingCount: row.findingCount,
    capitalUsd: row.capitalUsd,
    metadata: parseJson(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    turns: turns.map((t) => ({
      id: t.id,
      role: t.role as "user" | "resolve",
      text: t.text,
      phase: t.phase ?? undefined,
      capability: t.capability ?? undefined,
      findings: parseJson<MissionFinding[] | undefined>(t.findingsJson, undefined),
      actions: parseJson<CapabilityAction[] | undefined>(t.actionsJson, undefined),
      report: parseJson<MissionReport | undefined>(t.reportJson, undefined),
    })),
  };
}

export async function listMissions(userId: string, limit = 32): Promise<MissionRecord[]> {
  const rows = await prisma.resolveMission.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => toMissionRecord(r, []));
}

export async function getMission(userId: string, missionId: string): Promise<MissionRecord | null> {
  const row = await prisma.resolveMission.findFirst({
    where: { id: missionId, userId },
  });
  if (!row) return null;
  const turns = await prisma.resolveMissionTurn.findMany({
    where: { missionId },
    orderBy: { sortOrder: "asc" },
  });
  return toMissionRecord(row, turns);
}

export async function createMission(
  userId: string,
  input: { title?: string; ecosystemId?: string },
): Promise<MissionRecord> {
  const row = await prisma.resolveMission.create({
    data: {
      userId,
      title: input.title ?? "New mission",
      ecosystemId: input.ecosystemId,
      status: "created",
    },
  });
  await recordTimelineEvent({
    userId,
    ecosystemId: input.ecosystemId,
    missionId: row.id,
    eventType: "mission_created",
    title: "Mission started",
    detail: input.title ?? "New reasoning session",
    severity: "info",
  });
  return toMissionRecord(row, []);
}

export async function deleteMission(userId: string, missionId: string) {
  await prisma.resolveMission.deleteMany({ where: { id: missionId, userId } });
}

export async function appendMissionTurn(input: {
  userId: string;
  missionId: string;
  userText: string;
  resolve: {
    text: string;
    phase: MissionPhase;
    capability: CapabilityId;
    findings: MissionFinding[];
    actions: CapabilityAction[];
    report?: MissionReport;
    capitalUsd?: number;
    metadata?: Record<string, unknown>;
  };
  ecosystemId?: string;
}): Promise<MissionRecord> {
  const mission = await prisma.resolveMission.findFirst({
    where: { id: input.missionId, userId: input.userId },
  });
  if (!mission) throw new Error("Mission not found");

  const existingTurns = await prisma.resolveMissionTurn.count({
    where: { missionId: input.missionId },
  });
  const sortBase = existingTurns;

  await prisma.resolveMissionTurn.create({
    data: {
      missionId: input.missionId,
      role: "user",
      text: input.userText,
      sortOrder: sortBase,
    },
  });

  await prisma.resolveMissionTurn.create({
    data: {
      missionId: input.missionId,
      role: "resolve",
      text: input.resolve.text,
      phase: input.resolve.phase,
      capability: input.resolve.capability,
      findingsJson: JSON.stringify(input.resolve.findings),
      actionsJson: JSON.stringify(input.resolve.actions),
      reportJson: input.resolve.report ? JSON.stringify(input.resolve.report) : null,
      sortOrder: sortBase + 1,
    },
  });

  const nextStatus = statusForCapabilityPhase(
    input.resolve.capability,
    input.resolve.phase,
    input.resolve.capability === "execute_settlement" && input.resolve.phase === "execute",
  );

  const prevStatus = mission.status as MissionStatus;
  const status =
    canTransition(prevStatus, nextStatus) ? nextStatus : statusForCapabilityPhase(input.resolve.capability, input.resolve.phase);

  const title =
    mission.title === "New mission" || !mission.scope ?
      input.userText.slice(0, 80)
    : mission.title;

  const metadata = {
    ...parseJson<Record<string, unknown>>(mission.metadataJson, {}),
    ...input.resolve.metadata,
    lastCapability: input.resolve.capability,
    lastTraces: input.resolve.metadata?.traces,
  };

  await prisma.resolveMission.update({
    where: { id: input.missionId },
    data: {
      title,
      scope: mission.scope ?? input.userText,
      status,
      capability: input.resolve.capability,
      phase: input.resolve.phase,
      findingCount: input.resolve.findings.length,
      capitalUsd: input.resolve.capitalUsd ?? mission.capitalUsd,
      ecosystemId: input.ecosystemId ?? mission.ecosystemId,
      metadataJson: JSON.stringify(metadata),
    },
  });

  if (input.resolve.findings.length > 0) {
    const top = input.resolve.findings[0]!;
    await recordTimelineEvent({
      userId: input.userId,
      ecosystemId: input.ecosystemId ?? mission.ecosystemId ?? undefined,
      missionId: input.missionId,
      eventType: "finding_recorded",
      title: top.title,
      detail: top.insight,
      severity: top.severity === "critical" ? "critical" : "info",
      metadata: { findingId: top.id, confidence: top.confidence },
    });
  }

  await upsertKnowledgeFromMission({
    userId: input.userId,
    missionId: input.missionId,
    title,
    summary: input.resolve.text.slice(0, 500),
    findings: input.resolve.findings,
    ecosystemId: input.ecosystemId ?? mission.ecosystemId ?? undefined,
    capability: input.resolve.capability,
  });

  const full = await getMission(input.userId, input.missionId);
  if (!full) throw new Error("Mission persist failed");
  return full;
}

export async function updateMissionStatus(
  userId: string,
  missionId: string,
  status: MissionStatus,
  detail?: string,
) {
  const mission = await prisma.resolveMission.findFirst({
    where: { id: missionId, userId },
  });
  if (!mission) throw new Error("Mission not found");
  const prev = mission.status as MissionStatus;
  if (!canTransition(prev, status) && prev !== status) {
    throw new Error(`Cannot transition ${prev} → ${status}`);
  }
  await prisma.resolveMission.update({
    where: { id: missionId },
    data: { status },
  });
  await recordTimelineEvent({
    userId,
    ecosystemId: mission.ecosystemId ?? undefined,
    missionId,
    eventType: "status_changed",
    title: `Mission ${status}`,
    detail,
    severity: status === "failed" ? "critical" : "info",
    metadata: { from: prev, to: status },
  });
}

export async function migrateLocalSessions(
  userId: string,
  sessions: Array<{
    title: string;
    query: string;
    ecosystemId?: string;
    turns?: Array<{ role: string; text: string }>;
  }>,
) {
  let migrated = 0;
  for (const s of sessions) {
    const mission = await createMission(userId, {
      title: s.title || s.query || "Imported mission",
      ecosystemId: s.ecosystemId,
    });
    if (s.turns?.length) {
      for (let i = 0; i < s.turns.length; i += 2) {
        const user = s.turns[i];
        const resolve = s.turns[i + 1];
        if (user?.role === "user" && resolve?.role === "resolve") {
          await prisma.resolveMissionTurn.createMany({
            data: [
              { missionId: mission.id, role: "user", text: user.text, sortOrder: i },
              {
                missionId: mission.id,
                role: "resolve",
                text: resolve.text,
                sortOrder: i + 1,
              },
            ],
          });
        }
      }
    }
    migrated++;
  }
  return { migrated };
}
