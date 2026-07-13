import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import { appendOperationalEvent } from "@/lib/events/operational-event";

const requestSchema = z.object({ settlementBatchId: z.string().trim().min(1) });

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A settlement batch ID is required" }, { status: 400 });
  const batch = await prisma.settlementBatch.findUnique({ where: { id: parsed.data.settlementBatchId } });
  if (!batch) return NextResponse.json({ error: "Settlement package not found" }, { status: 404 });
  if (batch.userId !== ready.profile.id) return NextResponse.json({ error: "This settlement package belongs to another account" }, { status: 403 });

  const transactions = await prisma.chainTransaction.findMany({ where: { settlementBatchId: batch.id, txHash: { not: null } } });
  let confirmed = 0;
  let failed = 0;
  let pending = 0;
  for (const transaction of transactions) {
    const verification = await verifyArcTx(transaction.txHash!);
    if (verification.found && verification.success) {
      confirmed += 1;
      await prisma.chainTransaction.update({ where: { id: transaction.id }, data: { status: "confirmed", blockNumber: verification.blockNumber ? BigInt(verification.blockNumber) : undefined, confirmedAt: transaction.confirmedAt ?? new Date(), failureCode: null, failureMessage: null } });
    } else if (verification.status === "failed") {
      failed += 1;
      await prisma.chainTransaction.update({ where: { id: transaction.id }, data: { status: "failed", failureCode: "arc_receipt_failed", failureMessage: verification.error ?? "Arc receipt reported failure" } });
    } else {
      pending += 1;
      await prisma.chainTransaction.update({ where: { id: transaction.id }, data: { status: "submitted" } });
    }
  }
  const status = confirmed === batch.payeeCount
    ? "confirmed"
    : failed > 0 && confirmed > 0
      ? "partial"
      : failed > 0
        ? "failed"
        : pending > 0
          ? "submitted"
          : batch.status;
  await prisma.settlementBatch.update({ where: { id: batch.id }, data: { status, confirmedAt: status === "confirmed" ? batch.confirmedAt ?? new Date() : batch.confirmedAt } });
  await appendOperationalEvent({
    eventType: "settlement.batch_reconciled",
    aggregateType: "settlement_batch",
    aggregateId: batch.id,
    userId: ready.profile.id,
    communitySlug: batch.communitySlug,
    correlationId: batch.id,
    idempotencyKey: `settlement-reconcile:${batch.id}:${confirmed}:${pending}:${failed}`,
    payload: toJson({ settlementBatchId: batch.id, status, confirmed, pending, failed }),
  });
  return NextResponse.json({ ok: true, status, confirmed, pending, failed });
}
