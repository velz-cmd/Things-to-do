import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { compileSettlementPackage, hashCanonicalSettlementValue } from "@/lib/settlement/settlement-package";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";

type Context = { params: Promise<{ campaignId: string }> };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function POST(_request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { campaignId } = await context.params;
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: campaignId, creatorUserId: ready.user.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!campaign.simulationId || !campaign.activePolicyVersionId || !campaign.fundingIntentId) return NextResponse.json({ error: "Simulation, policy, and funding authorization are required before settlement." }, { status: 409 });
  const intent = await prisma.fundingIntent.findUnique({ where: { id: campaign.fundingIntentId } });
  if (intent?.status !== "confirmed") return NextResponse.json({ error: "Campaign funding is not confirmed." }, { status: 409 });
  const recoverableBatch = await prisma.settlementBatch.findFirst({ where: { userId: ready.profile.id, communitySlug: "outcome-campaign", fundingIntentId: campaign.fundingIntentId, status: { in: ["prepared", "submitting", "partial", "failed"] } }, orderBy: { createdAt: "desc" } });
  if (recoverableBatch) return NextResponse.json({ ok: true, replayed: true, settlementBatchId: recoverableBatch.id, totalUsd: formatUsdcTokenUnits(recoverableBatch.totalUsdcMicro), payeeCount: recoverableBatch.payeeCount, capitalUrl: `/capital?settlementBatch=${encodeURIComponent(recoverableBatch.id)}&returnTo=${encodeURIComponent("/earn?mode=creator")}` });
  const obligations = await prisma.obligation.findMany({ where: { communitySlug: "outcome-campaign", programVersionId: campaign.id, policyVersionId: campaign.activePolicyVersionId, status: "recognized", settlementBatchId: null }, orderBy: { id: "asc" } });
  if (!obligations.length) return NextResponse.json({ error: "No recognized campaign earnings are ready for settlement." }, { status: 409 });
  const blocked = obligations.find((item) => !item.identityId || !item.payoutDestinationId || item.blockerCode);
  if (blocked) return NextResponse.json({ error: "Every contributor needs a verified identity and payout destination.", obligationId: blocked.id, blocker: blocked.blockerCode ?? "identity_or_payout_unresolved" }, { status: 409 });
  const destinations = await prisma.payoutDestination.findMany({ where: { id: { in: obligations.flatMap((item) => item.payoutDestinationId ? [item.payoutDestinationId] : []) }, status: "verified" } });
  if (destinations.length !== obligations.length || destinations.some((destination) => !isAddress(destination.address))) return NextResponse.json({ error: "A verified payout destination is missing or is not a valid Arc address." }, { status: 409 });
  const evidenceIds = [...new Set(obligations.flatMap((item) => item.evidenceIds))];
  const evidence = await prisma.evidence.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, contentHash: true } });
  if (evidence.length !== evidenceIds.length) return NextResponse.json({ error: "Evidence lineage is incomplete; synchronize the affected submission again." }, { status: 409 });
  const preparedAt = new Date().toISOString();
  const compiled = compileSettlementPackage({ communityId: "outcome-campaign", programId: campaign.id, programVersionId: campaign.id, policyVersionId: campaign.activePolicyVersionId, simulationId: campaign.simulationId, preparedAt, evidenceContentHashes: evidence.map((item) => item.contentHash), payees: obligations.map((obligation) => { const payout = destinations.find((item) => item.id === obligation.payoutDestinationId)!; return { obligationId: obligation.id, identityId: obligation.identityId!, payoutDestinationId: payout.id, address: payout.address, amountUsdcMicro: obligation.amountUsdcMicro.toString(), evidenceIds: obligation.evidenceIds }; }) });
  const idempotencyKey = `outcome-settlement:${hashCanonicalSettlementValue({ campaignId: campaign.id, obligations: compiled.package.obligationIds, policy: campaign.activePolicyVersionId })}`;
  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.settlementBatch.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    const created = await tx.settlementBatch.create({ data: { userId: ready.profile.id, communitySlug: "outcome-campaign", fundingIntentId: campaign.fundingIntentId, status: "prepared", totalUsdcMicro: BigInt(compiled.package.totalUsdcMicro), payeeCount: compiled.package.payees.length, idempotencyKey, simulationId: campaign.simulationId, preparedPackage: json({ ...compiled.package, campaignId: campaign.id, campaignName: campaign.name, packageHash: compiled.packageHash }) } });
    await tx.obligation.updateMany({ where: { id: { in: compiled.package.obligationIds }, settlementBatchId: null, status: "recognized" }, data: { status: "authorization_pending", settlementBatchId: created.id } });
    await tx.earningsLedgerEntry.updateMany({ where: { obligationId: { in: compiled.package.obligationIds }, state: "recognized" }, data: { state: "awaiting_settlement" } });
    await tx.actionRun.create({ data: { userId: ready.user.id, actionId: "obligation.prepare_settlement", aggregateType: "SettlementBatch", aggregateId: created.id, idempotencyKey, state: "completed", recommendationReason: "Every included obligation has verified evidence, identity, payout destination, and confirmed campaign funding.", input: { campaignId: campaign.id, obligationIds: compiled.package.obligationIds }, output: { settlementBatchId: created.id, packageHash: compiled.packageHash, totalUsdcMicro: compiled.package.totalUsdcMicro }, completedAt: new Date() } });
    return created;
  });
  return NextResponse.json({ ok: true, settlementBatchId: batch.id, totalUsd: formatUsdcTokenUnits(batch.totalUsdcMicro), payeeCount: batch.payeeCount, capitalUrl: `/capital?settlementBatch=${encodeURIComponent(batch.id)}&returnTo=${encodeURIComponent("/earn?mode=creator")}` });
}
