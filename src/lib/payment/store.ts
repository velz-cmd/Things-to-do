import { prisma } from "@/lib/db";
import type {
  MissionSettlementInput,
  SettlementStatus,
  NanoPaymentRecord,
  PaymentIntent,
  SettlementProof,
} from "@/lib/payment/types";

export async function getSettledProofHashes(): Promise<string[]> {
  const rows = await prisma.missionSettlement.findMany({
    where: { status: { in: ["SETTLED", "PROCESSING", "ESCROW_LOCKED", "READY"] } },
    select: { proofHash: true },
  });
  return rows.map((r) => r.proofHash);
}

export async function findSettlementByMission(missionId: string) {
  return prisma.missionSettlement.findUnique({ where: { missionId } });
}

export async function createSettlementRecord(input: {
  package: MissionSettlementInput;
  status: SettlementStatus;
  poolsJson: string;
  auditHash: string;
}) {
  return prisma.missionSettlement.create({
    data: {
      missionId: input.package.missionId,
      repo: input.package.repo ?? null,
      treasuryAmount: input.package.treasuryAmount,
      currency: input.package.currency ?? "USDC",
      proofHash: input.package.proofHash,
      confidence: input.package.confidence,
      status: input.status,
      poolsJson: input.poolsJson,
      auditHash: input.auditHash,
      packageJson: JSON.stringify(input.package),
    },
  });
}

export async function updateSettlementStatus(
  id: string,
  status: SettlementStatus,
  extra?: {
    escrowTxHash?: string;
    batchNumber?: number;
    proofJson?: string;
    complianceJson?: string;
  },
) {
  return prisma.missionSettlement.update({
    where: { id },
    data: {
      status,
      escrowTxHash: extra?.escrowTxHash,
      batchNumber: extra?.batchNumber,
      proofJson: extra?.proofJson,
      complianceJson: extra?.complianceJson,
    },
  });
}

export async function savePaymentIntents(settlementId: string, intents: PaymentIntent[]) {
  await prisma.paymentIntent.createMany({
    data: intents.map((i) => ({
      settlementId,
      wallet: i.wallet,
      login: i.login ?? null,
      weight: i.weight,
      amountUsd: i.amountUsd,
      rank: i.rank ?? 0,
      memoText: i.memoText ?? null,
      memoId: i.memoId ?? null,
      status: i.status,
      txHash: i.txHash ?? null,
    })),
  });
}

export async function updatePaymentIntents(settlementId: string, intents: PaymentIntent[]) {
  for (const intent of intents) {
    await prisma.paymentIntent.updateMany({
      where: { settlementId, wallet: intent.wallet },
      data: {
        status: intent.status,
        txHash: intent.txHash ?? null,
        memoId: intent.memoId ?? null,
        memoText: intent.memoText ?? null,
      },
    });
  }
}

export async function saveNanoPayments(settlementId: string, records: NanoPaymentRecord[]) {
  await prisma.settlementNanoPayment.createMany({
    data: records.map((r) => ({
      settlementId,
      agentRole: r.agentRole,
      purpose: r.purpose,
      amountUsd: r.amountUsd,
      recipientWallet: r.recipientWallet,
      memoText: r.memoText,
      txHash: r.txHash ?? null,
      status: r.status,
    })),
  });
}

export async function emitPaymentEvent(
  settlementId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await prisma.paymentEvent.create({
    data: {
      settlementId,
      type,
      payloadJson: JSON.stringify(payload),
    },
  });
}

export async function getSettlementById(id: string) {
  return prisma.missionSettlement.findUnique({
    where: { id },
    include: {
      intents: true,
      nanoPayments: true,
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export async function getSettlementHistory(limit = 20) {
  return prisma.missionSettlement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { intents: true, nanoPayments: true },
  });
}

export async function getContributorHistory(wallet: string) {
  return prisma.paymentIntent.findMany({
    where: { wallet: { equals: wallet, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { settlement: true },
  });
}

export async function getNextBatchNumber(): Promise<number> {
  const last = await prisma.missionSettlement.findFirst({
    where: { batchNumber: { not: null } },
    orderBy: { batchNumber: "desc" },
    select: { batchNumber: true },
  });
  return (last?.batchNumber ?? 0) + 1;
}

export function proofToJson(proof: SettlementProof): string {
  return JSON.stringify(proof);
}
