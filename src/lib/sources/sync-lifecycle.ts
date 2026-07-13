import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appendOperationalEvent } from "@/lib/events/operational-event";
import { normalizeCommunityEvidence } from "@/lib/obligations/normalize-community";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function startSourceSync(input: {
  userId: string;
  communitySlug: string;
  provider: string;
  displayLabel?: string;
}) {
  const connection = await prisma.sourceConnection.upsert({
    where: {
      userId_provider_externalAccountId: {
        userId: input.userId,
        provider: input.provider,
        externalAccountId: `${input.userId}:default`,
      },
    },
    create: {
      userId: input.userId,
      communitySlug: input.communitySlug,
      provider: input.provider,
      externalAccountId: `${input.userId}:default`,
      displayLabel: input.displayLabel ?? input.provider,
      status: "connected",
      capabilitiesJson: toJson({ readEvidence: true, synchronize: true }),
    },
    update: {
      communitySlug: input.communitySlug,
      status: "connected",
      displayLabel: input.displayLabel ?? input.provider,
    },
  });
  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceConnectionId: connection.id,
      communitySlug: input.communitySlug,
      status: "fetching",
      startedAt: new Date(),
      metadata: toJson({ stage: "fetching" }),
    },
  });
  await appendOperationalEvent({
    eventType: "source.sync_started",
    aggregateType: "source_connection",
    aggregateId: connection.id,
    userId: input.userId,
    communitySlug: input.communitySlug,
    correlationId: run.id,
    idempotencyKey: `source-sync-started:${run.id}`,
    payload: toJson({ syncRunId: run.id, provider: input.provider, stage: "fetching" }),
  });
  return { connection, run };
}

export async function completeSourceSync(input: {
  userId: string;
  connectionId: string;
  syncRunId: string;
  communitySlug: string;
  provider: string;
  evidenceCount: number;
  result: unknown;
}) {
  const completedAt = new Date();
  await prisma.$transaction([
    prisma.sourceSyncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: "completed",
        evidenceCount: Math.max(0, Math.trunc(input.evidenceCount)),
        completedAt,
        metadata: toJson({ stage: "completed", result: input.result }),
        errorCode: null,
        errorMessage: null,
      },
    }),
    prisma.sourceConnection.update({
      where: { id: input.connectionId },
      data: { status: "connected", lastSyncedAt: completedAt },
    }),
  ]);
  await appendOperationalEvent({
    eventType: "source.sync_completed",
    aggregateType: "source_connection",
    aggregateId: input.connectionId,
    userId: input.userId,
    communitySlug: input.communitySlug,
    correlationId: input.syncRunId,
    idempotencyKey: `source-sync-completed:${input.syncRunId}`,
    payload: toJson({ syncRunId: input.syncRunId, provider: input.provider, evidenceCount: input.evidenceCount }),
  });
  await normalizeCommunityEvidence({
    userId: input.userId,
    communitySlug: input.communitySlug,
    provider: input.provider,
    sourceConnectionId: input.connectionId,
    syncRunId: input.syncRunId,
  }).catch(() => null);
}

export async function failSourceSync(input: {
  userId: string;
  connectionId: string;
  syncRunId: string;
  communitySlug: string;
  provider: string;
  error: unknown;
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  await prisma.sourceSyncRun.update({
    where: { id: input.syncRunId },
    data: {
      status: "sync_failed",
      completedAt: new Date(),
      errorCode: input.error instanceof Error ? input.error.name.slice(0, 100) : "sync_failed",
      errorMessage: message.slice(0, 1_000),
      metadata: toJson({ stage: "failed" }),
    },
  });
  await appendOperationalEvent({
    eventType: "source.sync_failed",
    aggregateType: "source_connection",
    aggregateId: input.connectionId,
    userId: input.userId,
    communitySlug: input.communitySlug,
    correlationId: input.syncRunId,
    idempotencyKey: `source-sync-failed:${input.syncRunId}`,
    payload: toJson({ syncRunId: input.syncRunId, provider: input.provider, errorCode: input.error instanceof Error ? input.error.name : "sync_failed" }),
  });
}
