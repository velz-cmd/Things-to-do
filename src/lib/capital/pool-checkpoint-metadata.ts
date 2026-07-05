import { prisma } from "@/lib/db";
import type {
  ProgramPoolMetadata,
  StoredCheckpointRecord,
} from "@/lib/capital/pool-checkpoint-types";

export function parseProgramPoolMetadata(
  metadataJson: string | null | undefined,
): ProgramPoolMetadata {
  if (!metadataJson?.trim()) return {};
  try {
    return JSON.parse(metadataJson) as ProgramPoolMetadata;
  } catch {
    return {};
  }
}

export async function recordPoolCheckpoint(
  programId: string,
  record: StoredCheckpointRecord,
): Promise<void> {
  const row = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    select: { metadataJson: true },
  });
  if (!row) return;

  const meta = parseProgramPoolMetadata(row.metadataJson);
  const prev = meta.checkpoints ?? [];
  const without = prev.filter((c) => c.thresholdUsd !== record.thresholdUsd);
  meta.checkpoints = [record, ...without].sort(
    (a, b) => a.thresholdUsd - b.thresholdUsd,
  );

  await prisma.resolveProgram.update({
    where: { id: programId },
    data: { metadataJson: JSON.stringify(meta) },
  });
}
