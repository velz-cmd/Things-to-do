import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { issueOutcomeReceipt } from "@/lib/outcomes/issue-receipt";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc/config";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed_creator") }),
  z.object({ action: z.literal("seed_recognition"), campaignId: z.string().min(1) }),
  z.object({ action: z.literal("confirm_settlement"), settlementBatchId: z.string().min(1) }),
]);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function POST(request: Request) {
  if (process.env.PLAYWRIGHT_ENABLED !== "true") return NextResponse.json({ error: "Not available" }, { status: 403 });
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid outcome fixture action." }, { status: 400 });

  if (parsed.data.action === "seed_creator") {
    const asset = await prisma.creatorAsset.upsert({ where: { ownerUserId_canonicalUrl: { ownerUserId: ready.user.id, canonicalUrl: "https://github.com/vercel/next.js/pull/1" } }, create: { ownerUserId: ready.user.id, type: "repository", canonicalUrl: "https://github.com/vercel/next.js/pull/1", title: "E2E verified project", sourceAdapterId: "github", externalId: "e2e-pr-1", ownershipState: "verified", ownershipVerifiedAt: new Date(), ownershipProof: json({ fixture: true, guard: "PLAYWRIGHT_ENABLED" }) }, update: { ownershipState: "verified", ownershipVerifiedAt: new Date() } });
    const campaign = await prisma.outcomeCampaign.create({ data: { creatorUserId: ready.user.id, assetId: asset.id, name: `E2E Outcome Campaign ${Date.now()}`, objective: "Reward one accepted documentation contribution with an exact capped amount.", contributionType: "documentation_merged", verificationAdapterId: "github", status: "simulation_required", totalBudgetMicroUsdc: BigInt(20_000_000), participantCapMicroUsdc: BigInt(5_000_000), startsAt: new Date() } });
    const formula = { mode: "fixed", amountMicroUsdc: "5000000" };
    const contentHash = createHash("sha256").update(`${campaign.id}:${JSON.stringify(formula)}`).digest("hex");
    const policy = await prisma.recognitionPolicyVersion.create({ data: { campaignId: campaign.id, version: 1, formula, evidenceRequirements: ["direct adapter evidence"], identityRequirements: ["connected contributor identity"], reviewDelaySeconds: 0, participantCapMicroUsdc: BigInt(5_000_000), campaignCapMicroUsdc: BigInt(20_000_000), contentHash, activeFrom: new Date() } });
    await prisma.outcomeCampaign.update({ where: { id: campaign.id }, data: { activePolicyVersionId: policy.id } });
    await prisma.user.update({ where: { id: ready.profile.id }, data: { githubUsername: ready.profile.githubUsername ?? "resolve-e2e" } });
    return NextResponse.json({ ok: true, assetId: asset.id, campaignId: campaign.id, campaignName: campaign.name });
  }

  if (parsed.data.action === "seed_recognition") {
    const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: parsed.data.campaignId, status: "active" } });
    const participant = await prisma.campaignParticipant.findUnique({ where: { campaignId_userId: { campaignId: parsed.data.campaignId, userId: ready.user.id } } });
    const payout = participant?.identityId ? await prisma.payoutDestination.findFirst({ where: { identityId: participant.identityId, status: "verified" } }) : null;
    if (!campaign || !participant?.identityId || !payout || !campaign.activePolicyVersionId) return NextResponse.json({ error: "Active campaign, joined identity, and payout are required." }, { status: 409 });
    const reference = `e2e-recognition:${campaign.id}:${ready.user.id}`;
    const existing = await prisma.earningsLedgerEntry.findUnique({ where: { referenceHash: reference } });
    if (existing) return NextResponse.json({ ok: true, obligationId: existing.obligationId, replayed: true });
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.workSubmission.create({ data: { campaignId: campaign.id, participantId: participant.id, userId: ready.user.id, workUrl: `https://github.com/vercel/next.js/pull/1#${campaign.id}`, status: "verified" } });
      const evidence = await tx.evidence.create({ data: { externalId: reference, kind: "documentation_merged", subjectRef: campaign.assetId, actorRef: participant.identityId, occurredAt: new Date(), contentHash: createHash("sha256").update(reference).digest("hex"), sourceUrl: submission.workUrl, payload: json({ fixture: true, guard: "PLAYWRIGHT_ENABLED", accepted: true }) } });
      const obligation = await tx.obligation.create({ data: { userId: ready.user.id, communitySlug: "outcome-campaign", programVersionId: campaign.id, policyVersionId: campaign.activePolicyVersionId!, identityId: participant.identityId, payoutDestinationId: payout.id, evidenceIds: [evidence.id], amountUsdcMicro: BigInt(5_000_000), status: "recognized", lineageHash: reference } });
      await tx.earningsLedgerEntry.create({ data: { userId: ready.user.id, campaignId: campaign.id, submissionId: submission.id, obligationId: obligation.id, type: "outcome_recognition", state: "recognized", amountMicroUsdc: BigInt(5_000_000), referenceHash: reference } });
      await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { committedMicroUsdc: { increment: BigInt(5_000_000) }, recognizedMicroUsdc: { increment: BigInt(5_000_000) } } });
      return obligation;
    });
    return NextResponse.json({ ok: true, obligationId: result.id });
  }

  const batch = await prisma.settlementBatch.findFirst({ where: { id: parsed.data.settlementBatchId, userId: ready.profile.id, communitySlug: "outcome-campaign" } });
  if (!batch) return NextResponse.json({ error: "Outcome settlement batch not found." }, { status: 404 });
  const prepared = batch.preparedPackage as Record<string, unknown>;
  const obligationIds = Array.isArray(prepared.obligationIds) ? prepared.obligationIds.filter((value): value is string => typeof value === "string") : [];
  const txHash = `0x${createHash("sha256").update(`e2e:${batch.id}`).digest("hex")}`;
  await prisma.$transaction(async (tx) => {
    await tx.chainTransaction.upsert({ where: { chainId_txHash: { chainId: ARC_TESTNET_CHAIN_ID, txHash } }, create: { settlementBatchId: batch.id, provider: "playwright_arc_fixture", providerTransactionId: batch.id, chainId: ARC_TESTNET_CHAIN_ID, txHash, amountUsdcMicro: batch.totalUsdcMicro, status: "confirmed", confirmedAt: new Date() }, update: { settlementBatchId: batch.id, status: "confirmed", confirmedAt: new Date() } });
    await tx.settlementBatch.update({ where: { id: batch.id }, data: { status: "confirmed", confirmedAt: new Date() } });
    await tx.obligation.updateMany({ where: { id: { in: obligationIds }, settlementBatchId: batch.id }, data: { status: "settled" } });
  });
  const receipt = await issueOutcomeReceipt(batch.id);
  return NextResponse.json({ ok: true, receiptUrl: receipt ? `/outcomes/${receipt.publicReference}` : null });
}
