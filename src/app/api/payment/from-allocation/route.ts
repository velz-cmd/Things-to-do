import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import {
  buildAllocationSettlementPlan,
  type AllocationSettlementPlan,
} from "@/lib/payment/from-allocation";
import {
  runPaymentSettlement,
  runPendingOnlyMission,
} from "@/lib/payment/orchestrator";
import type { GitHubAllocationResult } from "@/lib/github/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  allocation: z.unknown(),
  missionId: z.string().optional(),
  agentsRun: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  dryRun: z.boolean().optional(),
  execute: z.boolean().optional(),
});

function averageConfidence(allocation: GitHubAllocationResult): number {
  const scores = allocation.contributors.flatMap((c) => c.verdicts.map((v) => v.confidence));
  if (!scores.length) return 0.85;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000;
}

async function executePlan(
  plan: AllocationSettlementPlan,
  allocation: GitHubAllocationResult,
  founderUserId?: string,
) {
  if (!plan.package) {
    return runPendingOnlyMission({
      missionId: plan.missionId,
      repo: plan.repo,
      proofHash: plan.proofHash,
      confidence: plan.confidence,
      treasuryAmount: plan.treasuryAmount,
      pendingClaimUsd: plan.preview.pendingClaimUsd,
      allocation,
      pendingLogins: plan.pendingLogins,
      founderUserId,
      preview: plan.preview,
    });
  }

  return runPaymentSettlement(plan.package, {
    allocation,
    pendingLogins: plan.pendingLogins,
    founderUserId,
    preview: plan.preview,
  });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocation payload" }, { status: 400 });
  }

  const allocation = parsed.data.allocation as unknown as GitHubAllocationResult;
  if (!allocation?.owner || !allocation?.repo || !allocation?.weightProofHash) {
    return NextResponse.json(
      { error: "allocation must include owner, repo, weightProofHash" },
      { status: 400 },
    );
  }

  const confidence = parsed.data.confidence ?? averageConfidence(allocation);
  const plan = await buildAllocationSettlementPlan(allocation, {
    confidence,
    agentsRun: parsed.data.agentsRun,
    missionId: parsed.data.missionId,
  });

  if (parsed.data.dryRun || !parsed.data.execute) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      plan,
      preview: plan.preview,
      confidence,
    });
  }

  const result = await executePlan(plan, allocation, ready.user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return NextResponse.json(result);
}
