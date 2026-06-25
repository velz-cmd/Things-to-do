import { NextResponse } from "next/server";
import { z } from "zod";
import { runGithubPipeline } from "@/lib/github/allocate";

const intentSchema = z.object({
  infrastructure: z.number().min(0).max(100).optional(),
  documentation: z.number().min(0).max(100).optional(),
  community: z.number().min(0).max(100).optional(),
  research: z.number().min(0).max(100).optional(),
  bugfix: z.number().min(0).max(100).optional(),
});

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  fundPoolUsd: z.number().positive(),
  evaluationDays: z.number().min(1).max(365).optional(),
  founderIntent: intentSchema.optional(),
  useLlm: z.boolean().optional(),
});

/** GitHub Phase 1 — Evidence OS pipeline → allocation. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocation payload" }, { status: 400 });
  }

  const result = await runGithubPipeline(parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ...result.allocation,
    pipeline: {
      evidenceCount: result.busEvidenceCount,
      proof: result.proof,
      verdictCount: result.verdicts.length,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    name: "RESOLVE GitHub Allocation Engine",
    phase: "github-v1",
    flow: "Adapter → Evidence Bus → Workers → Reasoning → Confidence → Allocate → Arc",
    blueprint: "/api/github/blueprint",
    endpoint: "POST /api/github/allocate",
    requiredEnv: ["GITHUB_TOKEN"],
    optionalEnv: ["GROQ_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY"],
  });
}
