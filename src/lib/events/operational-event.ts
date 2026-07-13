import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type OperationalEventInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  userId?: string | null;
  communitySlug?: string | null;
  correlationId: string;
  idempotencyKey: string;
  payload: Prisma.InputJsonValue;
  occurredAt?: Date;
  outboxTopic?: string;
};

export async function appendOperationalEventInTransaction(
  tx: Prisma.TransactionClient,
  input: OperationalEventInput,
) {
  const event = await tx.operationalEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      userId: input.userId ?? null,
      communitySlug: input.communitySlug ?? null,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      occurredAt: input.occurredAt,
    },
    update: {},
  });

  const outbox = await tx.outboxEvent.upsert({
    where: { operationalEventId: event.id },
    create: {
      operationalEventId: event.id,
      topic: input.outboxTopic ?? input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
    },
    update: {},
  });

  return { event, outbox };
}

/**
 * Append an immutable operational event and its outbox row in one transaction.
 * Replaying the same idempotency key returns the original event and never emits
 * a second outbox message.
 */
export async function appendOperationalEvent(input: OperationalEventInput) {
  return prisma.$transaction((tx) => appendOperationalEventInTransaction(tx, input));
}

export async function markOutboxProcessed(id: string): Promise<void> {
  await prisma.outboxEvent.update({
    where: { id },
    data: { status: "processed", processedAt: new Date(), lastError: null },
  });
}

export async function markOutboxFailed(id: string, error: unknown): Promise<void> {
  await prisma.outboxEvent.update({
    where: { id },
    data: {
      status: "pending",
      attemptCount: { increment: 1 },
      lastError: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
      availableAt: new Date(Date.now() + 30_000),
    },
  });
}
