import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idempotency/service";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";
import { calculateRecognition, type RecognitionFormula } from "@/lib/outcomes/policy-engine";

function formulaFromJson(value: unknown): RecognitionFormula {
  const formula = value as Record<string, unknown>;
  if (formula.mode === "fixed") return { mode: "fixed", amountMicroUsdc: BigInt(String(formula.amountMicroUsdc)) };
  if (formula.mode === "per_unit") return { mode: "per_unit", rateMicroUsdc: BigInt(String(formula.rateMicroUsdc)), minimumUnits: formula.minimumUnits ? BigInt(String(formula.minimumUnits)) : undefined, maximumPayableUnits: formula.maximumPayableUnits ? BigInt(String(formula.maximumPayableUnits)) : undefined };
  if (formula.mode === "hybrid") return { mode: "hybrid", approvedBaseMicroUsdc: BigInt(String(formula.approvedBaseMicroUsdc)), rateMicroUsdc: BigInt(String(formula.rateMicroUsdc)), maximumMicroUsdc: BigInt(String(formula.maximumMicroUsdc)) };
  throw new Error("Unsupported recognition formula.");
}

function jsonPayload(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { submissionId } = await params;
  const submission = await prisma.workSubmission.findFirst({ where: { id: submissionId, userId: ready.user.id } });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  const [campaign, participant, latestSnapshot] = await Promise.all([
    prisma.outcomeCampaign.findUnique({ where: { id: submission.campaignId } }),
    prisma.campaignParticipant.findUnique({ where: { id: submission.participantId } }),
    prisma.outcomeSnapshot.findFirst({ where: { submissionId }, orderBy: { observedAt: "desc" } }),
  ]);
  if (!campaign || !participant || !latestSnapshot) return NextResponse.json({ error: "Campaign, participant, or baseline is missing." }, { status: 409 });
  const adapter = getOutcomeAdapter(campaign.verificationAdapterId);
  if (!adapter || adapter.status !== "live") return NextResponse.json({ error: "The verification provider is unavailable. Previous outcome data remains unchanged." }, { status: 503 });
  const baselineValue = { adapterId: latestSnapshot.adapterId, sourceObjectId: latestSnapshot.sourceObjectId, objectUrl: submission.workUrl, objectLabel: submission.workUrl, unitType: latestSnapshot.unitType as "events" | "views", value: latestSnapshot.value, observedAt: latestSnapshot.observedAt.toISOString(), contentHash: latestSnapshot.contentHash };
  const synchronized = await adapter.synchronize({ url: submission.workUrl, baseline: baselineValue });
  const key = request.headers.get("idempotency-key") ?? `outcome.synchronize:${submission.id}:${synchronized.snapshot.contentHash}`;
  const { data, replayed } = await runIdempotent({ key, scope: "outcome.synchronize", userId: ready.user.id, request: { submissionId, contentHash: synchronized.snapshot.contentHash }, execute: async () => prisma.$transaction(async (tx) => {
    const finish = async (output: Prisma.InputJsonObject) => {
      await tx.actionRun.upsert({ where: { idempotencyKey: key }, update: {}, create: { userId: ready.user.id, actionId: "outcome.synchronize", aggregateType: "WorkSubmission", aggregateId: submission.id, idempotencyKey: key, state: "completed", recommendationReason: "The provider snapshot changed and was reconciled atomically against the accepted baseline.", input: { submissionId }, output, completedAt: new Date() } });
      return output;
    };
    const abnormalSpike = latestSnapshot.value > BigInt(0) && synchronized.incrementalValue > latestSnapshot.value * BigInt(10) + BigInt(10_000);
    const conflict = synchronized.conflict ?? (abnormalSpike ? "The incremental metric exceeds the automatic-review threshold." : undefined);
    const evidence = await adapter.buildEvidence({ snapshot: synchronized.snapshot });
    const sourceEventId = `${synchronized.snapshot.sourceObjectId}:${synchronized.snapshot.contentHash}`;
    const event = await tx.outcomeEvent.create({ data: { adapterId: adapter.id, sourceEventId, campaignId: campaign.id, submissionId: submission.id, type: adapter.id === "github" ? "repository_pr_merged" : "qualified_view", actorIdentityId: participant.identityId, objectUrl: synchronized.snapshot.objectUrl, objectLabel: synchronized.snapshot.objectLabel, unitType: synchronized.snapshot.unitType, unitValue: synchronized.incrementalValue, baselineValue: latestSnapshot.value, currentValue: synchronized.snapshot.value, incrementalValue: synchronized.incrementalValue, evidenceState: conflict ? "conflicted" : evidence.state, recognitionState: conflict ? "unreviewed" : "eligible", contentHash: synchronized.snapshot.contentHash, observedAt: new Date(synchronized.snapshot.observedAt), synchronizedAt: new Date() } });
    const payload = jsonPayload(evidence.payload);
    const canonicalEvidence = await tx.evidence.upsert({ where: { kind_externalId_contentHash: { kind: event.type, externalId: sourceEventId, contentHash: evidence.contentHash } }, update: {}, create: { externalId: sourceEventId, kind: event.type, subjectRef: campaign.assetId, actorRef: participant.identityId, occurredAt: event.observedAt, contentHash: evidence.contentHash, sourceUrl: evidence.sourceUrl, payload } });
    await tx.outcomeEvidence.create({ data: { outcomeEventId: event.id, evidenceId: canonicalEvidence.id, provider: evidence.provider, sourceUrl: evidence.sourceUrl, state: conflict ? "conflicted" : evidence.state, payload, contentHash: evidence.contentHash } });
    const savedSnapshot = await tx.outcomeSnapshot.create({ data: { submissionId: submission.id, adapterId: synchronized.snapshot.adapterId, sourceObjectId: synchronized.snapshot.sourceObjectId, unitType: synchronized.snapshot.unitType, value: synchronized.snapshot.value, contentHash: synchronized.snapshot.contentHash, observedAt: new Date(synchronized.snapshot.observedAt) } });
    await tx.workSubmission.update({ where: { id: submission.id }, data: { latestSnapshotId: savedSnapshot.id, latestOutcomeEventId: event.id, status: conflict ? "review_required" : "verified" } });
    if (conflict) {
      await tx.fraudReview.upsert({ where: { submissionId: submission.id }, update: { state: "review_required", reasons: [conflict] }, create: { submissionId: submission.id, state: "review_required", reasons: [conflict] } });
      return finish({ eventId: event.id, state: "review_required", recognizedMicroUsdc: "0", blocker: conflict });
    }
    const currentCampaign = await tx.outcomeCampaign.findUnique({ where: { id: campaign.id } });
    const policy = currentCampaign?.activePolicyVersionId ? await tx.recognitionPolicyVersion.findUnique({ where: { id: currentCampaign.activePolicyVersionId } }) : null;
    if (!currentCampaign || !policy) return finish({ eventId: event.id, state: "blocked", recognizedMicroUsdc: "0", blocker: "No active campaign policy exists." });
    if (!participant.identityId) return finish({ eventId: event.id, state: "blocked", recognizedMicroUsdc: "0", blocker: "Connect and verify the required contributor identity." });
    const participantRecognized = await tx.earningsLedgerEntry.aggregate({ where: { campaignId: campaign.id, userId: ready.user.id, type: "outcome_recognition" }, _sum: { amountMicroUsdc: true } });
    const participantRemaining = policy.participantCapMicroUsdc ? policy.participantCapMicroUsdc - (participantRecognized._sum.amountMicroUsdc ?? BigInt(0)) : undefined;
    const recognition = calculateRecognition({ formula: formulaFromJson(policy.formula), verifiedUnits: synchronized.incrementalValue, approved: true, participantCapMicroUsdc: participantRemaining && participantRemaining > BigInt(0) ? participantRemaining : participantRemaining === undefined ? undefined : BigInt(0), campaignRemainingMicroUsdc: currentCampaign.totalBudgetMicroUsdc - currentCampaign.committedMicroUsdc });
    if (recognition.amountMicroUsdc <= BigInt(0)) return finish({ eventId: event.id, state: "eligible", recognizedMicroUsdc: "0", blocker: "The verified outcome has not reached the policy minimum or an allocation cap has been reached." });
    const lineageHash = createHash("sha256").update(`${event.id}:${policy.id}:${participant.identityId}:${recognition.amountMicroUsdc}`).digest("hex");
    const destination = await tx.payoutDestination.findFirst({ where: { identityId: participant.identityId, status: "verified" } });
    const obligation = await tx.obligation.create({ data: { userId: ready.user.id, communitySlug: "outcome-campaign", programVersionId: campaign.id, policyVersionId: policy.id, identityId: participant.identityId, payoutDestinationId: destination?.id, evidenceIds: [canonicalEvidence.id], amountUsdcMicro: recognition.amountMicroUsdc, status: destination ? "recognized" : "blocked_identity", blockerCode: destination ? null : "payout_destination_required", lineageHash } });
    await tx.earningsLedgerEntry.create({ data: { userId: ready.user.id, campaignId: campaign.id, submissionId: submission.id, obligationId: obligation.id, type: "outcome_recognition", state: destination ? "recognized" : "awaiting_authorization", amountMicroUsdc: recognition.amountMicroUsdc, referenceHash: lineageHash } });
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { committedMicroUsdc: { increment: recognition.amountMicroUsdc }, recognizedMicroUsdc: { increment: recognition.amountMicroUsdc } } });
    await tx.outcomeEvent.update({ where: { id: event.id }, data: { recognitionState: "recognized" } });
    return destination
      ? finish({ eventId: event.id, obligationId: obligation.id, state: "recognized", recognizedMicroUsdc: recognition.amountMicroUsdc.toString() })
      : finish({ eventId: event.id, obligationId: obligation.id, state: "awaiting_authorization", recognizedMicroUsdc: recognition.amountMicroUsdc.toString(), blocker: "Add a verified payout destination before settlement." });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) });
  return NextResponse.json({ ...data, replayed });
}
