import { NextResponse } from "next/server";
import { z } from "zod";
import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { askValueAdvisor, getNextSteps } from "@/lib/workspace/advisors/synthesize";

const bodySchema = z.object({
  question: z.string().min(1).max(2000).optional(),
});

/** Conversational Value Workspace — evidence-backed advisor over real APIs. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const evidence = await gatherWorkspaceEvidence();
  const result = parsed.data.question
    ? await askValueAdvisor({ question: parsed.data.question, evidence })
    : await getNextSteps(evidence);

  return NextResponse.json({
    ok: true,
    ...result,
    evidenceAt: evidence.gatheredAt,
  });
}

export async function GET() {
  const evidence = await gatherWorkspaceEvidence();
  const result = await getNextSteps(evidence);
  return NextResponse.json({
    ok: true,
    ...result,
    evidenceAt: evidence.gatheredAt,
  });
}
