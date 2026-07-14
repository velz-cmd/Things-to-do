import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ campaignId: string }> };

export async function POST(_request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { campaignId } = await context.params;
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: campaignId, creatorUserId: ready.user.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (["funding_required", "ready_to_publish"].includes(campaign.status) && campaign.fundingIntentId) {
    return NextResponse.json({ ok: true, replayed: true, campaignId: campaign.id, fundingIntentId: campaign.fundingIntentId, status: campaign.status, capitalUrl: `/capital?fundingIntent=${encodeURIComponent(campaign.fundingIntentId)}&returnTo=${encodeURIComponent("/earn?mode=creator")}` });
  }
  if (campaign.status !== "approval_required" || !campaign.blueprintId || !campaign.simulationId) return NextResponse.json({ error: "Run the deterministic simulation before approval." }, { status: 409 });
  const [asset, requirement] = await Promise.all([prisma.creatorAsset.findUnique({ where: { id: campaign.assetId } }), prisma.campaignFundingRequirement.findUnique({ where: { campaignId: campaign.id } })]);
  if (asset?.ownershipState !== "verified") return NextResponse.json({ error: "Verify asset ownership before approving funding." }, { status: 409 });
  if (!requirement || requirement.status !== "simulated") return NextResponse.json({ error: "The simulated funding requirement is missing." }, { status: 409 });
  const key = `campaign.approve_blueprint:${campaign.id}:${campaign.simulationId}`;
  const intentKey = `outcome-campaign-funding:${campaign.id}:${campaign.simulationId}`;
  const result = await prisma.$transaction(async (tx) => {
    const intent = await tx.fundingIntent.upsert({ where: { idempotencyKey: intentKey }, create: { userId: ready.profile.id, blueprintId: campaign.blueprintId, communitySlug: "outcome-campaign", programId: campaign.id, amountUsdcMicro: requirement.amountMicroUsdc, status: "requires_funding", idempotencyKey: intentKey, returnTo: "/earn?mode=creator", expiresAt: campaign.endsAt }, update: {} });
    await tx.campaignFundingRequirement.update({ where: { campaignId: campaign.id }, data: { fundingIntentId: intent.id, status: intent.status === "confirmed" ? "funded" : "authorization_required" } });
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { status: intent.status === "confirmed" ? "ready_to_publish" : "funding_required", fundingIntentId: intent.id, approvedAt: new Date() } });
    await tx.blueprint.update({ where: { id: campaign.blueprintId! }, data: { status: "approved" } });
    await tx.actionRun.upsert({ where: { idempotencyKey: key }, create: { userId: ready.user.id, actionId: "campaign.approve_blueprint", aggregateType: "OutcomeCampaign", aggregateId: campaign.id, idempotencyKey: key, state: "completed", recommendationReason: "Ownership and deterministic budget simulation passed; Capital can now authorize the exact funding requirement.", input: { campaignId: campaign.id, simulationId: campaign.simulationId }, output: { fundingIntentId: intent.id, status: intent.status === "confirmed" ? "ready_to_publish" : "funding_required" }, completedAt: new Date() }, update: {} });
    return intent;
  });
  return NextResponse.json({ ok: true, campaignId: campaign.id, fundingIntentId: result.id, status: result.status === "confirmed" ? "ready_to_publish" : "funding_required", capitalUrl: `/capital?fundingIntent=${encodeURIComponent(result.id)}&returnTo=${encodeURIComponent("/earn?mode=creator")}`, nextAction: result.status === "confirmed" ? "campaign.publish" : "capital.authorize" });
}
