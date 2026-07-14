import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { transitionCampaignRuntimeState } from "@/lib/outcomes/campaign-lifecycle";

type Context = { params: Promise<{ campaignId: string }> };
const bodySchema = z.object({ action: z.enum(["pause", "resume", "close"]) });

export async function POST(request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose pause, resume, or close." }, { status: 400 });
  const { campaignId } = await context.params;
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: campaignId, creatorUserId: ready.user.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const status = transitionCampaignRuntimeState(campaign.status, parsed.data.action);
  if (!status) return NextResponse.json({ error: `Campaign cannot ${parsed.data.action} from ${campaign.status}.` }, { status: 409 });
  if (parsed.data.action === "resume" && campaign.endsAt && campaign.endsAt <= new Date()) return NextResponse.json({ error: "A campaign cannot resume after its end date." }, { status: 409 });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { status, closedAt: status === "closed" ? now : null } });
    await tx.actionRun.create({ data: { userId: ready.user.id, actionId: `campaign.${parsed.data.action}`, aggregateType: "OutcomeCampaign", aggregateId: campaign.id, idempotencyKey: `campaign.${parsed.data.action}:${campaign.id}:${campaign.updatedAt.toISOString()}`, state: "completed", recommendationReason: status === "closed" ? "Closing stops new submissions while preserving recognized obligations and settlement lineage." : `${parsed.data.action} changes contribution intake without changing existing evidence.`, input: { campaignId: campaign.id, previousStatus: campaign.status }, output: { status }, completedAt: now } });
  });
  return NextResponse.json({ ok: true, campaignId: campaign.id, status });
}
