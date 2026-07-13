import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { arcFeatureFlags } from "@/lib/arc/feature-flags";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc/config";
import { sendUsdcWithMemo } from "@/lib/arc/memo";
import { appendOperationalEvent } from "@/lib/events/operational-event";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";
import {
  type CanonicalSettlementPackage,
  verifySettlementPackage,
} from "@/lib/settlement/settlement-package";

const requestSchema = z.object({
  settlementBatchId: z.string().trim().min(1),
  confirm: z.literal(true),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readPreparedPackage(value: Prisma.JsonValue): {
  settlementPackage: CanonicalSettlementPackage;
  packageHash: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { packageHash, ...settlementPackage } = value as Record<string, unknown>;
  if (typeof packageHash !== "string") return null;
  return { settlementPackage: settlementPackage as CanonicalSettlementPackage, packageHash };
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Explicit settlement confirmation is required" }, { status: 400 });
  if (!arcFeatureFlags.batchSettlement || !arcFeatureFlags.memo) {
    return NextResponse.json({
      error: !arcFeatureFlags.batchSettlement
        ? "Live Arc batch settlement is disabled until testnet capability checks pass"
        : "Arc memo settlement is disabled until contract capability checks pass",
      code: "arc_feature_disabled",
    }, { status: 409 });
  }

  const batch = await prisma.settlementBatch.findUnique({ where: { id: parsed.data.settlementBatchId } });
  if (!batch) return NextResponse.json({ error: "Settlement package not found" }, { status: 404 });
  if (batch.userId !== ready.profile.id) {
    return NextResponse.json({ error: "This settlement package belongs to another account" }, { status: 403 });
  }
  if (batch.status === "confirmed") {
    return NextResponse.json({ ok: true, status: "confirmed", replayed: true });
  }
  if (batch.status === "submitting") {
    return NextResponse.json({ error: "This settlement package is already being submitted" }, { status: 409 });
  }
  const prepared = readPreparedPackage(batch.preparedPackage);
  if (!prepared || !verifySettlementPackage(prepared.settlementPackage, prepared.packageHash)) {
    return NextResponse.json({ error: "Settlement package integrity check failed" }, { status: 409 });
  }
  if (prepared.settlementPackage.totalUsdcMicro !== batch.totalUsdcMicro.toString()) {
    return NextResponse.json({ error: "Settlement package amount does not match its ledger record" }, { status: 409 });
  }

  const claimed = await prisma.settlementBatch.updateMany({
    where: { id: batch.id, status: { in: ["prepared", "partial", "failed"] } },
    data: { status: "submitting", submittedAt: batch.submittedAt ?? new Date() },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "Settlement package state changed; refresh before authorizing" }, { status: 409 });
  }

  let succeeded = 0;
  const failures: Array<{ obligationId: string; message: string }> = [];
  for (const payee of prepared.settlementPackage.payees) {
    const existing = await prisma.chainTransaction.findFirst({
      where: { settlementBatchId: batch.id, providerTransactionId: payee.obligationId, status: "confirmed" },
    });
    if (existing) {
      succeeded += 1;
      continue;
    }
    try {
      const amountUsd = Number(formatUsdcTokenUnits(BigInt(payee.amountUsdcMicro)));
      const result = await sendUsdcWithMemo({
        recipient: payee.address as `0x${string}`,
        amountUsd,
        memo: JSON.stringify({ version: 1, settlementBatchId: batch.id, obligationId: payee.obligationId, packageHash: prepared.packageHash }),
        memoRef: `resolve:settlement:${batch.id}:${payee.obligationId}`,
      });
      await prisma.$transaction([
        prisma.chainTransaction.upsert({
          where: { chainId_txHash: { chainId: ARC_TESTNET_CHAIN_ID, txHash: result.txHash } },
          create: {
            settlementBatchId: batch.id,
            provider: "circle_arc_memo",
            providerTransactionId: payee.obligationId,
            chainId: ARC_TESTNET_CHAIN_ID,
            txHash: result.txHash,
            toAddress: payee.address,
            amountUsdcMicro: BigInt(payee.amountUsdcMicro),
            status: "confirmed",
            confirmedAt: new Date(),
          },
          update: { settlementBatchId: batch.id, providerTransactionId: payee.obligationId, status: "confirmed", confirmedAt: new Date() },
        }),
        prisma.obligation.updateMany({
          where: { id: payee.obligationId, userId: ready.profile.id, settlementBatchId: batch.id },
          data: { status: "settled" },
        }),
      ]);
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Arc transfer failed";
      failures.push({ obligationId: payee.obligationId, message });
      await prisma.chainTransaction.create({
        data: {
          settlementBatchId: batch.id,
          provider: "circle_arc_memo",
          providerTransactionId: payee.obligationId,
          chainId: ARC_TESTNET_CHAIN_ID,
          toAddress: payee.address,
          amountUsdcMicro: BigInt(payee.amountUsdcMicro),
          status: "failed",
          failureCode: "arc_transfer_failed",
          failureMessage: message,
        },
      });
    }
  }

  const finalStatus = failures.length ? (succeeded ? "partial" : "failed") : "confirmed";
  await prisma.settlementBatch.update({
    where: { id: batch.id },
    data: { status: finalStatus, confirmedAt: finalStatus === "confirmed" ? new Date() : null },
  });
  await appendOperationalEvent({
    eventType: `settlement.batch_${finalStatus}`,
    aggregateType: "settlement_batch",
    aggregateId: batch.id,
    userId: ready.profile.id,
    communitySlug: batch.communitySlug,
    correlationId: batch.id,
    idempotencyKey: `settlement-batch-result:${batch.id}:${succeeded}:${failures.length}`,
    payload: toJson({ settlementBatchId: batch.id, packageHash: prepared.packageHash, status: finalStatus, succeeded, failed: failures.length, failures }),
  });

  return NextResponse.json({ ok: failures.length === 0, status: finalStatus, succeeded, failed: failures.length, failures }, { status: failures.length ? 207 : 200 });
}
