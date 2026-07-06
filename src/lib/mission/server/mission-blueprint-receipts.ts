import { prisma } from "@/lib/db";
import type { MissionReportRecord } from "@/lib/mission/mission-report-store";
import type { BlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";
import type { MissionEvidenceLink } from "@/lib/mission/mission-evidence-links";

export type StoredMissionReceipt = {
  id: string;
  userId: string | null;
  communitySlug: string;
  status: string;
  package: MissionReportRecord;
  simulation?: MissionReportRecord["simulation"];
  settlement?: BlueprintSettlementPreview;
  fundTxHash?: string | null;
  fundTxLabel?: string | null;
  programId?: string | null;
  evidenceLinks?: MissionEvidenceLink[];
  createdAt: string;
  updatedAt: string;
};

function rowToReceipt(row: {
  id: string;
  userId: string | null;
  communitySlug: string;
  status: string;
  packageJson: string;
  simulationJson: string | null;
  settlementJson: string | null;
  fundTxHash: string | null;
  fundTxLabel: string | null;
  programId: string | null;
  evidenceJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredMissionReceipt {
  const pkg = JSON.parse(row.packageJson) as MissionReportRecord;
  return {
    id: row.id,
    userId: row.userId,
    communitySlug: row.communitySlug,
    status: row.status,
    package: pkg,
    simulation: row.simulationJson
      ? (JSON.parse(row.simulationJson) as MissionReportRecord["simulation"])
      : pkg.simulation,
    settlement: row.settlementJson
      ? (JSON.parse(row.settlementJson) as BlueprintSettlementPreview)
      : undefined,
    fundTxHash: row.fundTxHash,
    fundTxLabel: row.fundTxLabel,
    programId: row.programId,
    evidenceLinks: row.evidenceJson
      ? (JSON.parse(row.evidenceJson) as MissionEvidenceLink[])
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertMissionBlueprintReceipt(input: {
  record: MissionReportRecord;
  userId?: string | null;
  settlement?: BlueprintSettlementPreview;
  evidenceLinks?: MissionEvidenceLink[];
  fundTxHash?: string;
  programId?: string | null;
}): Promise<StoredMissionReceipt> {
  const row = await prisma.missionBlueprintReceipt.upsert({
    where: { id: input.record.id },
    create: {
      id: input.record.id,
      userId: input.userId ?? null,
      communitySlug: input.record.communitySlug,
      status: input.record.status,
      packageJson: JSON.stringify(input.record),
      simulationJson: input.record.simulation ? JSON.stringify(input.record.simulation) : null,
      settlementJson: input.settlement ? JSON.stringify(input.settlement) : null,
      fundTxHash: input.fundTxHash ?? null,
      fundTxLabel: input.record.fundTxLabel ?? null,
      programId: input.programId ?? input.record.programId ?? null,
      evidenceJson: input.evidenceLinks ? JSON.stringify(input.evidenceLinks) : null,
    },
    update: {
      userId: input.userId ?? undefined,
      status: input.record.status,
      packageJson: JSON.stringify(input.record),
      simulationJson: input.record.simulation ? JSON.stringify(input.record.simulation) : null,
      settlementJson: input.settlement ? JSON.stringify(input.settlement) : null,
      fundTxHash: input.fundTxHash ?? undefined,
      fundTxLabel: input.record.fundTxLabel ?? undefined,
      programId: input.programId ?? input.record.programId ?? undefined,
      evidenceJson: input.evidenceLinks ? JSON.stringify(input.evidenceLinks) : null,
    },
  });
  return rowToReceipt(row);
}

export async function getMissionBlueprintReceipt(
  id: string,
): Promise<StoredMissionReceipt | null> {
  const row = await prisma.missionBlueprintReceipt.findUnique({ where: { id } });
  if (!row) return null;
  return rowToReceipt(row);
}

export async function getMissionMemoryForCommunity(input: {
  communitySlug: string;
  userId?: string | null;
}): Promise<StoredMissionReceipt | null> {
  const row = await prisma.missionBlueprintReceipt.findFirst({
    where: {
      communitySlug: input.communitySlug,
      status: "authorized",
      ...(input.userId ? { userId: input.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return rowToReceipt(row);
}

export async function listMissionBlueprintReceiptsForUser(
  userId: string,
  limit = 20,
): Promise<StoredMissionReceipt[]> {
  const rows = await prisma.missionBlueprintReceipt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(rowToReceipt);
}
