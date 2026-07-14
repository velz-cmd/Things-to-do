import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idempotency/service";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";
import { getSessionUser } from "@/lib/auth/session";

const schema = z.object({ assetId: z.string().min(1), name: z.string().min(3).max(160), objective: z.string().min(10).max(4000), contributionType: z.string().min(2).max(80), verificationAdapterId: z.string().min(2), totalBudgetMicroUsdc: z.string().regex(/^\d+$/), participantCapMicroUsdc: z.string().regex(/^\d+$/).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), formula: z.discriminatedUnion("mode", [z.object({ mode: z.literal("fixed"), amountMicroUsdc: z.string().regex(/^\d+$/) }), z.object({ mode: z.literal("per_unit"), unitType: z.string(), rateMicroUsdc: z.string().regex(/^\d+$/), minimumUnits: z.string().regex(/^\d+$/).optional(), maximumPayableUnits: z.string().regex(/^\d+$/).optional() }), z.object({ mode: z.literal("hybrid"), approvedBaseMicroUsdc: z.string().regex(/^\d+$/), unitType: z.string(), rateMicroUsdc: z.string().regex(/^\d+$/), maximumMicroUsdc: z.string().regex(/^\d+$/) })]) });

export async function GET() {
  const user = await getSessionUser();
  const campaigns = await prisma.outcomeCampaign.findMany({ where: { status: "active", startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { startsAt: "desc" }, take: 50, select: { id: true, assetId: true, name: true, objective: true, contributionType: true, verificationAdapterId: true, totalBudgetMicroUsdc: true, committedMicroUsdc: true, participantCapMicroUsdc: true, startsAt: true, endsAt: true, status: true } });
  const [assets, participants] = await Promise.all([
    prisma.creatorAsset.findMany({ where: { id: { in: campaigns.map((campaign) => campaign.assetId) }, ownershipState: "verified" }, select: { id: true, title: true, canonicalUrl: true } }),
    user ? prisma.campaignParticipant.findMany({ where: { userId: user.id, campaignId: { in: campaigns.map((campaign) => campaign.id) }, status: "joined" }, select: { campaignId: true, identityId: true } }) : Promise.resolve([]),
  ]);
  return NextResponse.json({ campaigns: campaigns.map((campaign) => { const asset = assets.find((item) => item.id === campaign.assetId); const participant = participants.find((item) => item.campaignId === campaign.id); return { ...campaign, assetTitle: asset?.title ?? "Verified creator asset", assetUrl: asset?.canonicalUrl ?? null, joined: Boolean(participant), identityConnected: Boolean(participant?.identityId), totalBudgetMicroUsdc: campaign.totalBudgetMicroUsdc.toString(), committedMicroUsdc: campaign.committedMicroUsdc.toString(), participantCapMicroUsdc: campaign.participantCapMicroUsdc?.toString() ?? null }; }) });
}

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Campaign input is incomplete or uses invalid integer amounts." }, { status: 400 });
  const asset = await prisma.creatorAsset.findFirst({ where: { id: parsed.data.assetId, ownerUserId: ready.user.id } });
  if (!asset) return NextResponse.json({ error: "Register an asset you control before creating this campaign." }, { status: 404 });
  const adapter = getOutcomeAdapter(parsed.data.verificationAdapterId);
  if (!adapter || adapter.status !== "live") return NextResponse.json({ error: "The selected verification adapter is not live." }, { status: 409 });
  if (asset.sourceAdapterId !== adapter.id) return NextResponse.json({ error: "The campaign verification adapter must match the registered asset provider." }, { status: 409 });
  const budget = BigInt(parsed.data.totalBudgetMicroUsdc);
  if (budget <= BigInt(0)) return NextResponse.json({ error: "Campaign budget must be greater than zero." }, { status: 400 });
  const key = request.headers.get("idempotency-key") ?? `campaign.create_draft:${ready.user.id}:${asset.id}:${createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex")}`;
  const { data, replayed } = await runIdempotent({ key, scope: "campaign.create_draft", userId: ready.user.id, request: parsed.data, execute: async () => {
    const run = await prisma.actionRun.create({ data: { userId: ready.user.id, actionId: "campaign.create_draft", aggregateType: "OutcomeCampaign", idempotencyKey: key, state: "running", recommendationReason: "A draft and immutable policy version are required before deterministic simulation.", input: parsed.data } });
    const campaign = await prisma.outcomeCampaign.create({ data: { creatorUserId: ready.user.id, assetId: asset.id, name: parsed.data.name, objective: parsed.data.objective, contributionType: parsed.data.contributionType, verificationAdapterId: adapter.id, status: "simulation_required", totalBudgetMicroUsdc: budget, participantCapMicroUsdc: parsed.data.participantCapMicroUsdc ? BigInt(parsed.data.participantCapMicroUsdc) : null, startsAt: new Date(parsed.data.startsAt), endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null } });
    const contentHash = createHash("sha256").update(JSON.stringify({ campaignId: campaign.id, formula: parsed.data.formula, cap: parsed.data.totalBudgetMicroUsdc })).digest("hex");
    const policy = await prisma.recognitionPolicyVersion.create({ data: { campaignId: campaign.id, version: 1, formula: parsed.data.formula, evidenceRequirements: ["direct adapter evidence", "incremental outcome after baseline"], identityRequirements: ["connected contributor identity"], reviewDelaySeconds: 3600, participantCapMicroUsdc: campaign.participantCapMicroUsdc, campaignCapMicroUsdc: budget, contentHash, activeFrom: new Date(parsed.data.startsAt) } });
    await prisma.outcomeCampaign.update({ where: { id: campaign.id }, data: { activePolicyVersionId: policy.id } });
    await prisma.actionRun.update({ where: { id: run.id }, data: { aggregateId: campaign.id, state: "completed", completedAt: new Date(), output: { campaignId: campaign.id, policyVersionId: policy.id, status: "simulation_required" } } });
    return { campaignId: campaign.id, policyVersionId: policy.id, status: "simulation_required", blocker: asset.ownershipState === "verified" ? "Run deterministic budget simulation." : "Verify asset ownership, then run deterministic budget simulation." };
  } });
  return NextResponse.json({ ...data, replayed }, { status: 201 });
}
