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
  if (campaign.status === "active") return NextResponse.json({ ok: true, campaignId, status: "active", replayed: true });
  if (!campaign.fundingIntentId || !campaign.activePolicyVersionId || !campaign.simulationId) return NextResponse.json({ error: "Approval, policy, and simulation are required before publication." }, { status: 409 });
  const [asset, intent] = await Promise.all([prisma.creatorAsset.findUnique({ where: { id: campaign.assetId } }), prisma.fundingIntent.findUnique({ where: { id: campaign.fundingIntentId } })]);
  if (asset?.ownershipState !== "verified") return NextResponse.json({ error: "Asset ownership is no longer verified." }, { status: 409 });
  if (intent?.status !== "confirmed") return NextResponse.json({ error: "Capital must confirm the campaign funding intent before publication.", fundingIntentId: campaign.fundingIntentId }, { status: 409 });
  if (campaign.endsAt && campaign.endsAt <= new Date()) return NextResponse.json({ error: "The campaign end date has passed." }, { status: 409 });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { status: "active", publishedAt: campaign.publishedAt ?? now } });
    await tx.campaignFundingRequirement.update({ where: { campaignId: campaign.id }, data: { status: "funded" } });
    if (campaign.blueprintId) await tx.blueprint.update({ where: { id: campaign.blueprintId }, data: { status: "authorized" } });
    await tx.actionRun.upsert({ where: { idempotencyKey: `campaign.publish:${campaign.id}:${intent.id}` }, create: { userId: ready.user.id, actionId: "campaign.publish", aggregateType: "OutcomeCampaign", aggregateId: campaign.id, idempotencyKey: `campaign.publish:${campaign.id}:${intent.id}`, state: "completed", recommendationReason: "Ownership, immutable policy, simulation, and confirmed funding are all present.", input: { campaignId: campaign.id, fundingIntentId: intent.id }, output: { status: "active", publishedAt: now.toISOString() }, completedAt: now }, update: {} });
  });
  return NextResponse.json({ ok: true, campaignId: campaign.id, status: "active", discoverUrl: `/discover?mode=campaigns&campaign=${encodeURIComponent(campaign.id)}` });
}
