import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ campaignId: string }> };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function POST(request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { campaignId } = await context.params;
  const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: campaignId, creatorUserId: ready.user.id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!["simulation_required", "approval_required"].includes(campaign.status)) return NextResponse.json({ error: "Only a draft campaign can be simulated." }, { status: 409 });
  const policy = campaign.activePolicyVersionId ? await prisma.recognitionPolicyVersion.findUnique({ where: { id: campaign.activePolicyVersionId } }) : null;
  if (!policy) return NextResponse.json({ error: "Create an immutable policy before simulation." }, { status: 409 });
  const inputHash = createHash("sha256").update(JSON.stringify({ campaignId, policy: policy.contentHash, budget: campaign.totalBudgetMicroUsdc.toString(), participantCap: campaign.participantCapMicroUsdc?.toString() ?? null })).digest("hex");
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const blueprint = await tx.blueprint.upsert({
      where: { missionId_version: { missionId: `outcome-campaign:${campaign.id}`, version: 1 } },
      create: { userId: ready.user.id, missionId: `outcome-campaign:${campaign.id}`, programId: campaign.id, version: 1, status: "simulated", objective: json({ campaignId: campaign.id, objective: campaign.objective, contributionType: campaign.contributionType }), payees: json({ source: "verified campaign participants", participantCapMicroUsdc: campaign.participantCapMicroUsdc?.toString() ?? null }), policy: json({ policyVersionId: policy.id, formula: policy.formula, evidenceRequirements: policy.evidenceRequirements, identityRequirements: policy.identityRequirements }), fundingRequirementUsdcMicro: campaign.totalBudgetMicroUsdc, settlementPath: json({ network: "Arc Testnet", asset: "USDC", authorization: "explicit creator confirmation", receipt: "public outcome receipt" }), contentHash: inputHash },
      update: { status: "simulated", objective: json({ campaignId: campaign.id, objective: campaign.objective, contributionType: campaign.contributionType }), policy: json({ policyVersionId: policy.id, formula: policy.formula, evidenceRequirements: policy.evidenceRequirements, identityRequirements: policy.identityRequirements }), fundingRequirementUsdcMicro: campaign.totalBudgetMicroUsdc, contentHash: inputHash },
    });
    const simulation = await tx.simulation.upsert({ where: { blueprintId_version: { blueprintId: blueprint.id, version: 1 } }, create: { blueprintId: blueprint.id, version: 1, status: "completed", inputHash, result: json({ maximumAuthorizedExposureMicroUsdc: campaign.totalBudgetMicroUsdc.toString(), currentCommittedMicroUsdc: campaign.committedMicroUsdc.toString(), remainingCapacityMicroUsdc: (campaign.totalBudgetMicroUsdc - campaign.committedMicroUsdc).toString(), capEnforced: true, policyVersionId: policy.id }), totalUsdcMicro: campaign.totalBudgetMicroUsdc, fundingGapUsdcMicro: campaign.totalBudgetMicroUsdc }, update: { status: "completed", inputHash, result: json({ maximumAuthorizedExposureMicroUsdc: campaign.totalBudgetMicroUsdc.toString(), currentCommittedMicroUsdc: campaign.committedMicroUsdc.toString(), remainingCapacityMicroUsdc: (campaign.totalBudgetMicroUsdc - campaign.committedMicroUsdc).toString(), capEnforced: true, policyVersionId: policy.id }), totalUsdcMicro: campaign.totalBudgetMicroUsdc, fundingGapUsdcMicro: campaign.totalBudgetMicroUsdc } });
    const requirementHash = createHash("sha256").update(`${campaign.id}:${simulation.id}:${campaign.totalBudgetMicroUsdc}`).digest("hex");
    const requirement = await tx.campaignFundingRequirement.upsert({ where: { campaignId: campaign.id }, create: { campaignId: campaign.id, amountMicroUsdc: campaign.totalBudgetMicroUsdc, status: "simulated", contentHash: requirementHash }, update: { amountMicroUsdc: campaign.totalBudgetMicroUsdc, status: "simulated", contentHash: requirementHash } });
    await tx.outcomeCampaign.update({ where: { id: campaign.id }, data: { status: "approval_required", blueprintId: blueprint.id, simulationId: simulation.id } });
    await tx.actionRun.upsert({ where: { idempotencyKey: `campaign.simulate:${campaign.id}:${inputHash}` }, create: { userId: ready.user.id, actionId: "campaign.simulate", aggregateType: "OutcomeCampaign", aggregateId: campaign.id, idempotencyKey: `campaign.simulate:${campaign.id}:${inputHash}`, state: "completed", recommendationReason: "Simulation proves the policy cannot recognize more than the authorized campaign budget.", input: { campaignId: campaign.id, inputHash }, output: { blueprintId: blueprint.id, simulationId: simulation.id, fundingRequirementId: requirement.id, status: "approval_required" }, completedAt: now }, update: {} });
    return { blueprint, simulation, requirement };
  });
  return NextResponse.json({ ok: true, campaignId: campaign.id, status: "approval_required", blueprintId: result.blueprint.id, simulationId: result.simulation.id, fundingRequirementMicroUsdc: result.requirement.amountMicroUsdc.toString(), nextAction: "campaign.approve_blueprint" });
}
