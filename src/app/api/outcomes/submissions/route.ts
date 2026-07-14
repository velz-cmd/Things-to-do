import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idempotency/service";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";

const schema = z.object({ campaignId: z.string().min(1), workUrl: z.string().url(), sourceReference: z.string().max(500).optional() });

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Provide a campaign and canonical work URL." }, { status: 400 });
  const participant = await prisma.campaignParticipant.findUnique({ where: { campaignId_userId: { campaignId: parsed.data.campaignId, userId: ready.user.id } } });
  if (!participant || participant.status !== "joined") return NextResponse.json({ error: "Join the campaign before submitting work." }, { status: 409 });
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: parsed.data.campaignId, status: "active" } });
  if (!campaign) return NextResponse.json({ error: "The campaign is not accepting submissions." }, { status: 409 });
  const adapter = getOutcomeAdapter(campaign.verificationAdapterId);
  if (!adapter || adapter.status !== "live") return NextResponse.json({ error: "The campaign verification source is unavailable." }, { status: 409 });
  const validation = await adapter.validateSource({ url: parsed.data.workUrl });
  if (!validation.valid) return NextResponse.json({ error: validation.blocker ?? "The work URL could not be verified." }, { status: 422 });
  const baseline = await adapter.captureBaseline({ url: parsed.data.workUrl });
  const key = request.headers.get("idempotency-key") ?? `submission.create:${campaign.id}:${ready.user.id}:${parsed.data.workUrl}`;
  const { data, replayed } = await runIdempotent({ key, scope: "submission.create", userId: ready.user.id, request: parsed.data, execute: async () => {
    const submission = await prisma.workSubmission.create({ data: { campaignId: campaign.id, participantId: participant.id, userId: ready.user.id, workUrl: parsed.data.workUrl, sourceReference: parsed.data.sourceReference, status: "pending_verification" } });
    const savedBaseline = await prisma.outcomeSnapshot.create({ data: { submissionId: submission.id, adapterId: baseline.adapterId, sourceObjectId: baseline.sourceObjectId, unitType: baseline.unitType, value: baseline.value, contentHash: baseline.contentHash, observedAt: new Date(baseline.observedAt) } });
    await prisma.workSubmission.update({ where: { id: submission.id }, data: { latestSnapshotId: savedBaseline.id } });
    await prisma.fraudReview.create({ data: { submissionId: submission.id, state: "not_required", reasons: [] } });
    await prisma.actionRun.create({ data: { userId: ready.user.id, actionId: "submission.create", aggregateType: "WorkSubmission", aggregateId: submission.id, idempotencyKey: key, state: "completed", recommendationReason: "A canonical submission and accepted baseline are required before incremental outcomes can be recognized.", input: parsed.data, output: { submissionId: submission.id, baselineId: savedBaseline.id, baselineValue: baseline.value.toString() }, completedAt: new Date() } });
    return { submissionId: submission.id, baselineId: savedBaseline.id, baselineValue: baseline.value.toString(), state: "pending_verification" };
  } });
  return NextResponse.json({ ...data, replayed }, { status: 201 });
}
