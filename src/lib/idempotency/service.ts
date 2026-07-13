import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type IdempotencyRecord } from "@prisma/client";
import { prisma } from "@/lib/db";

type JsonObject = Prisma.InputJsonObject;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function hashIdempotentRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export class IdempotencyConflictError extends Error {
  constructor(message: string, readonly code: "payload_mismatch" | "in_progress" | "previously_rejected") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export async function beginIdempotentOperation(input: {
  key: string;
  scope: string;
  userId?: string | null;
  request: unknown;
  expiresAt?: Date;
}): Promise<{ record: IdempotencyRecord; created: boolean }> {
  const requestHash = hashIdempotentRequest(input.request);
  try {
    const record = await prisma.idempotencyRecord.create({
      data: {
        key: input.key,
        scope: input.scope,
        userId: input.userId ?? null,
        requestHash,
        expiresAt: input.expiresAt,
      },
    });
    return { record, created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const record = await prisma.idempotencyRecord.findUniqueOrThrow({ where: { key: input.key } });
    if (record.requestHash !== requestHash) {
      throw new IdempotencyConflictError(
        "This idempotency key was already used with a different request.",
        "payload_mismatch",
      );
    }
    return { record, created: false };
  }
}

export async function completeIdempotentOperation(
  key: string,
  response: JsonObject,
): Promise<void> {
  await prisma.idempotencyRecord.update({
    where: { key },
    data: { status: "completed", response, errorCode: null },
  });
}

export async function rejectIdempotentOperation(key: string, errorCode: string): Promise<void> {
  await prisma.idempotencyRecord.update({
    where: { key },
    data: { status: "rejected", errorCode: errorCode.slice(0, 120) },
  });
}

export async function runIdempotent<T extends JsonObject>(input: {
  key: string;
  scope: string;
  userId?: string | null;
  request: unknown;
  execute: () => Promise<T>;
}): Promise<{ data: T; replayed: boolean }> {
  const { record, created } = await beginIdempotentOperation(input);
  if (!created) {
    if (record.status === "completed" && record.response) {
      return { data: record.response as T, replayed: true };
    }
    if (record.status === "rejected") {
      throw new IdempotencyConflictError(
        "The earlier operation was rejected. Use a new key after resolving the blocker.",
        "previously_rejected",
      );
    }
    throw new IdempotencyConflictError(
      "The earlier operation is still awaiting completion.",
      "in_progress",
    );
  }

  try {
    const data = await input.execute();
    await completeIdempotentOperation(input.key, data);
    return { data, replayed: false };
  } catch (error) {
    await rejectIdempotentOperation(
      input.key,
      error instanceof Error ? error.name : "operation_failed",
    ).catch(() => null);
    throw error;
  }
}
