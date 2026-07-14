import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idempotency/service";

export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { campaignId } = await params;
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: campaignId, status: "active" } });
  if (!campaign) return NextResponse.json({ error: "This campaign is not open for participation." }, { status: 409 });
  const identity = await prisma.identity.findFirst({ where: { userId: ready.user.id, status: "verified", canonicalRef: { startsWith: `${campaign.verificationAdapterId}:` } }, orderBy: { verifiedAt: "desc" } });
  const key = request.headers.get("idempotency-key") ?? `campaign.join:${campaignId}:${ready.user.id}`;
  const { data, replayed } = await runIdempotent({ key, scope: "campaign.join", userId: ready.user.id, request: { campaignId }, execute: async () => {
    const participant = await prisma.campaignParticipant.upsert({ where: { campaignId_userId: { campaignId, userId: ready.user.id } }, update: { status: "joined", identityId: identity?.id }, create: { campaignId, userId: ready.user.id, identityId: identity?.id } });
    await prisma.actionRun.create({ data: { userId: ready.user.id, actionId: "campaign.join", aggregateType: "CampaignParticipant", aggregateId: participant.id, idempotencyKey: key, state: "completed", recommendationReason: "Joining records eligibility before external work is submitted.", input: { campaignId }, output: { participantId: participant.id, identityConnected: Boolean(identity) }, completedAt: new Date() } });
    return { participantId: participant.id, identityConnected: Boolean(identity), blocker: identity ? null : "Connect and verify the platform identity required by this campaign before recognition." };
  } });
  return NextResponse.json({ ...data, replayed }, { status: 201 });
}
