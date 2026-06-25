import { NextResponse } from "next/server";
import { z } from "zod";
import { runGithubPipeline } from "@/lib/github/pipeline";
import { allocationToMissionSettlement } from "@/lib/payment/from-allocation";
import { runPaymentSettlement } from "@/lib/payment/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  fundPoolUsd: z.number().positive(),
  evaluationDays: z.number().min(1).max(365).optional(),
  dryRun: z.boolean().optional(),
  execute: z.boolean().optional(),
});

/**
 * GitHub Intelligence → MissionSettlement → Payment Layer
 * Scoring happens in pipeline; payment layer only settles the verified package.
 */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "owner, repo, and fundPoolUsd are required" }, { status: 400 });
    }

    const pipeline = await runGithubPipeline(parsed.data);
    if ("error" in pipeline) {
      return NextResponse.json({ error: pipeline.error }, { status: 404 });
    }

    const allocation = pipeline.allocation;
    const confidences = pipeline.verdicts.map((v) => v.confidence.settlement);
    const confidence =
      confidences.length ?
        confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.85;

    const agentsRun = [
      "identity_worker",
      "repository_worker",
      "pr_worker",
      "code_worker",
      "collaboration_worker",
      "impact_worker",
      "reputation_worker",
      "ecosystem_worker",
      "reasoning_engine",
    ];

    const pkg = await allocationToMissionSettlement(allocation, { confidence, agentsRun });

    if ("error" in pkg) {
      return NextResponse.json(
        { error: pkg.error, missingWallets: pkg.missingWallets, allocation },
        { status: 400 },
      );
    }

    if (parsed.data.dryRun || !parsed.data.execute) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        package: pkg,
        allocation: {
          contributors: allocation.contributors.length,
          confidence,
          proofHash: allocation.weightProofHash,
        },
      });
    }

    const result = await runPaymentSettlement(pkg);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub settlement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
