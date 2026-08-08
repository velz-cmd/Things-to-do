import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc/config";
import { prisma } from "@/lib/db";
import { canonicalOutcomeHref } from "@/lib/discover/receipt-links";
import { explorerTxUrl } from "@/lib/settlement/arc-config";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export type ConfirmedDirectSupport = {
  actionRunId: string;
  receiptId: string;
  receiptReference: string;
  receiptUrl: string;
  explorerUrl: string;
  txHash: string;
  amountUsd: number;
  destinationAddress: string;
  purpose: "direct_support" | "work_reward";
  workSubjectId?: string;
};

export async function recordConfirmedDirectSupport(input: {
  actionRunId: string;
  idempotencyKey: string;
  senderUserId: string;
  senderAddress: string;
  recipientUserId: string;
  recipientLabel: string;
  destinationAddress: string;
  amountUsd: number;
  txHash: string;
  provider: "circle_arc_direct_support" | "connected_wallet_arc_direct_support";
  purpose?: "direct_support" | "work_reward";
  work?: {
    subjectId: string;
    title: string;
    repository: string;
    sourceUrl: string;
    evidenceIds: string[];
  };
}): Promise<ConfirmedDirectSupport> {
  const purpose = input.purpose ?? "direct_support";
  if (purpose === "work_reward" && !input.work) {
    throw new Error("Verified work evidence is required before recording a work reward.");
  }
  const amountUsdcMicro = BigInt(Math.round(input.amountUsd * 1_000_000));
  const packageHash = createHash("sha256")
    .update(
      JSON.stringify({
        kind: purpose,
        idempotencyKey: input.idempotencyKey,
        senderUserId: input.senderUserId,
        recipientUserId: input.recipientUserId,
        destinationAddress: input.destinationAddress.toLowerCase(),
        amountUsdcMicro: amountUsdcMicro.toString(),
        txHash: input.txHash.toLowerCase(),
        workSubjectId: input.work?.subjectId,
      }),
    )
    .digest("hex");
  const batchKey = `${purpose === "work_reward" ? "work-reward" : "direct-support"}:${input.idempotencyKey}`;
  const publicReference = `${purpose === "work_reward" ? "work" : "support"}_${createHash("sha256")
    .update(`${batchKey}:${packageHash}`)
    .digest("hex")
    .slice(0, 24)}`;

  return prisma.$transaction(async (tx) => {
    const batch = await tx.settlementBatch.upsert({
      where: { idempotencyKey: batchKey },
      create: {
        userId: input.senderUserId,
        status: "confirmed",
        totalUsdcMicro: amountUsdcMicro,
        payeeCount: 1,
        idempotencyKey: batchKey,
        submittedAt: new Date(),
        confirmedAt: new Date(),
        preparedPackage: json({
          version: 1,
          kind: purpose,
          packageHash,
          senderUserId: input.senderUserId,
          recipientUserId: input.recipientUserId,
          recipientLabel: input.recipientLabel,
          destinationAddress: input.destinationAddress,
          amountUsdcMicro: amountUsdcMicro.toString(),
          work: input.work,
        }),
      },
      update: {},
    });
    const recordedTransaction = await tx.chainTransaction.findUnique({
      where: {
        chainId_txHash: {
          chainId: ARC_TESTNET_CHAIN_ID,
          txHash: input.txHash,
        },
      },
      select: { settlementBatchId: true },
    });
    if (recordedTransaction && recordedTransaction.settlementBatchId !== batch.id) {
      throw new Error("This Arc transaction is already attached to another settlement receipt.");
    }
    const transaction = await tx.chainTransaction.upsert({
      where: {
        chainId_txHash: {
          chainId: ARC_TESTNET_CHAIN_ID,
          txHash: input.txHash,
        },
      },
      create: {
        settlementBatchId: batch.id,
        provider: input.provider,
        providerTransactionId: input.idempotencyKey,
        chainId: ARC_TESTNET_CHAIN_ID,
        txHash: input.txHash,
        fromAddress: input.senderAddress,
        toAddress: input.destinationAddress,
        amountUsdcMicro,
        status: "confirmed",
        confirmedAt: new Date(),
      },
      update: {
        settlementBatchId: batch.id,
        providerTransactionId: input.idempotencyKey,
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });
    const receipt = await tx.receipt.upsert({
      where: { settlementBatchId: batch.id },
      create: {
        settlementBatchId: batch.id,
        chainTransactionId: transaction.id,
        publicReference,
        totalUsdcMicro: amountUsdcMicro,
        payeeCount: 1,
        payload: json({
          type: purpose,
          senderUserId: input.senderUserId,
          recipientUserId: input.recipientUserId,
          recipientLabel: input.recipientLabel,
          destinationAddress: input.destinationAddress,
          transactionHash: input.txHash,
          packageHash,
          work: input.work,
        }),
      },
      update: {},
    });
    const output: ConfirmedDirectSupport = {
      actionRunId: input.actionRunId,
      receiptId: receipt.id,
      receiptReference: receipt.publicReference,
      receiptUrl: canonicalOutcomeHref(receipt.publicReference),
      explorerUrl: explorerTxUrl(input.txHash),
      txHash: input.txHash,
      amountUsd: input.amountUsd,
      destinationAddress: input.destinationAddress,
      purpose,
      workSubjectId: input.work?.subjectId,
    };
    await tx.actionRun.update({
      where: { id: input.actionRunId },
      data: {
        aggregateType: "Receipt",
        aggregateId: receipt.id,
        state: "completed",
        output: json(output),
        completedAt: new Date(),
      },
    });
    await tx.operationalEvent.upsert({
      where: { idempotencyKey: `event:${batchKey}` },
      create: {
        eventType: purpose === "work_reward"
          ? "discover.work_reward_confirmed"
          : "discover.direct_support_confirmed",
        aggregateType: "Receipt",
        aggregateId: receipt.id,
        userId: input.senderUserId,
        correlationId: randomUUID(),
        idempotencyKey: `event:${batchKey}`,
        payload: json({
          receiptId: receipt.id,
          recipientUserId: input.recipientUserId,
          amountUsdcMicro: amountUsdcMicro.toString(),
          txHash: input.txHash,
          purpose,
          workSubjectId: input.work?.subjectId,
          title: input.work?.title,
          repository: input.work?.repository,
          publicReference,
        }),
      },
      update: {},
    });
    await tx.operationalEvent.upsert({
      where: { idempotencyKey: `recipient-event:${batchKey}` },
      create: {
        eventType: purpose === "work_reward"
          ? "discover.work_reward_received"
          : "discover.direct_support_received",
        aggregateType: "Receipt",
        aggregateId: receipt.id,
        userId: input.recipientUserId,
        correlationId: randomUUID(),
        idempotencyKey: `recipient-event:${batchKey}`,
        payload: json({
          receiptId: receipt.id,
          senderUserId: input.senderUserId,
          amountUsdcMicro: amountUsdcMicro.toString(),
          txHash: input.txHash,
          purpose,
          workSubjectId: input.work?.subjectId,
          title: input.work?.title,
          repository: input.work?.repository,
          publicReference,
        }),
      },
      update: {},
    });
    return output;
  });
}
