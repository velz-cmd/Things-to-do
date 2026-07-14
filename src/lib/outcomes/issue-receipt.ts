import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function issueOutcomeReceipt(settlementBatchId: string) {
  const existing = await prisma.receipt.findUnique({ where: { settlementBatchId } });
  if (existing) return existing;
  const batch = await prisma.settlementBatch.findUnique({ where: { id: settlementBatchId } });
  if (!batch || batch.communitySlug !== "outcome-campaign" || batch.status !== "confirmed") return null;
  const prepared = batch.preparedPackage && typeof batch.preparedPackage === "object" && !Array.isArray(batch.preparedPackage) ? batch.preparedPackage as Record<string, unknown> : {};
  const campaignId = typeof prepared.campaignId === "string" ? prepared.campaignId : typeof prepared.programId === "string" ? prepared.programId : null;
  const obligationIds = Array.isArray(prepared.obligationIds) ? prepared.obligationIds.filter((value): value is string => typeof value === "string") : [];
  if (!campaignId || !obligationIds.length) return null;
  const [campaign, asset, transactions, ledger] = await Promise.all([
    prisma.outcomeCampaign.findUnique({ where: { id: campaignId } }),
    prisma.outcomeCampaign.findUnique({ where: { id: campaignId } }).then((row) => row ? prisma.creatorAsset.findUnique({ where: { id: row.assetId } }) : null),
    prisma.chainTransaction.findMany({ where: { settlementBatchId, status: "confirmed" }, orderBy: { confirmedAt: "asc" } }),
    prisma.earningsLedgerEntry.findMany({ where: { obligationId: { in: obligationIds } }, select: { submissionId: true, obligationId: true } }),
  ]);
  if (!campaign || !transactions.length) return null;
  const submissionIds = ledger.flatMap((entry) => entry.submissionId ? [entry.submissionId] : []);
  const [submissions, events] = await Promise.all([
    prisma.workSubmission.findMany({ where: { id: { in: submissionIds } }, select: { id: true, workUrl: true } }),
    prisma.outcomeEvent.findMany({ where: { submissionId: { in: submissionIds }, recognitionState: "recognized" }, orderBy: { observedAt: "asc" }, select: { type: true, unitType: true, incrementalValue: true, contentHash: true } }),
  ]);
  const packageHash = typeof prepared.packageHash === "string" ? prepared.packageHash : createHash("sha256").update(settlementBatchId).digest("hex");
  const publicReference = `out_${createHash("sha256").update(`${settlementBatchId}:${packageHash}`).digest("hex").slice(0, 24)}`;
  const firstTransaction = transactions[0]!;
  return prisma.$transaction(async (tx) => {
    const replay = await tx.receipt.findUnique({ where: { settlementBatchId } });
    if (replay) return replay;
    const receipt = await tx.receipt.create({ data: { settlementBatchId, chainTransactionId: firstTransaction.id, communitySlug: "outcome-campaign", publicReference, totalUsdcMicro: batch.totalUsdcMicro, payeeCount: batch.payeeCount, payload: json({ campaignId: campaign.id, campaignName: campaign.name, creatorLabel: asset?.title ?? "Verified creator asset", workReference: submissions.length === 1 ? submissions[0]!.workUrl : `${submissions.length} verified work submissions`, verifiedOutcome: [...new Set(events.map((event) => event.type.replaceAll("_", " ")))].join(", ") || "Verified campaign outcomes", evidenceSource: campaign.verificationAdapterId, policyVersionId: campaign.activePolicyVersionId, contentHash: packageHash, transactionHashes: transactions.flatMap((transaction) => transaction.txHash ? [transaction.txHash] : []), eventCount: events.length, outcomeUnits: events.map((event) => ({ unitType: event.unitType, value: event.incrementalValue?.toString() ?? "0", contentHash: event.contentHash })) }) } });
    await tx.earningsLedgerEntry.updateMany({ where: { obligationId: { in: obligationIds } }, data: { receiptId: receipt.id, state: "settled" } });
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { settledMicroUsdc: { increment: batch.totalUsdcMicro } } });
    await tx.actionRun.upsert({ where: { idempotencyKey: `outcome-receipt:${batch.id}` }, create: { userId: campaign.creatorUserId, actionId: "receipt.open", aggregateType: "Receipt", aggregateId: receipt.id, idempotencyKey: `outcome-receipt:${batch.id}`, state: "completed", recommendationReason: "Arc confirmed every transaction in the canonical outcome settlement package.", input: { settlementBatchId: batch.id }, output: { receiptId: receipt.id, publicReference: receipt.publicReference }, completedAt: new Date() }, update: {} });
    return receipt;
  });
}
