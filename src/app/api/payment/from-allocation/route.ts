import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { allocationToMissionSettlement } from "@/lib/payment/from-allocation";
import { createSettlementDraft, runPaymentSettlement } from "@/lib/payment/orchestrator";
import type { GitHubAllocationResult } from "@/lib/github/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  allocation: z.unknown(),
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

/**
 * Intelligence Layer → MissionSettlement → Payment Layer
 * Accepts verified GitHub allocation output only. Never rescans GitHub.
 */
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
    return NextResponse.json({ error: "allocation must include owner, repo, weightProofHash" }, { status: 400 });
  }

  const confidence = parsed.data.confidence ?? averageConfidence(allocation);
  const pkg = await allocationToMissionSettlement(allocation, {
    confidence,
    agentsRun: parsed.data.agentsRun,
  });

  if ("error" in pkg) {
    return NextResponse.json(
      { error: pkg.error, missingWallets: pkg.missingWallets },
      { status: 400 },
    );
  }

  if (parsed.data.dryRun || !parsed.data.execute) {
    const draft = await createSettlementDraft(pkg);
    if ("error" in draft) {
      return NextResponse.json({ error: draft.error, code: draft.code }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      dryRun: true,
      package: pkg,
      draft,
      confidence,
    });
  }

  const result = await runPaymentSettlement(pkg);
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return NextResponse.json(result);
}
