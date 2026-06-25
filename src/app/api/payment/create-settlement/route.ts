import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { createSettlementDraft } from "@/lib/payment/orchestrator";

const contributorSchema = z.object({
  wallet: z.string(),
  login: z.string().optional(),
  weight: z.number(),
  amount: z.string(),
  rank: z.number().optional(),
});

const bodySchema = z.object({
  missionId: z.string(),
  repo: z.string().optional(),
  treasuryAmount: z.number().positive(),
  currency: z.literal("USDC").optional(),
  confidence: z.number().min(0).max(1),
  proofHash: z.string().min(8),
  contributors: z.array(contributorSchema).min(1),
  agentsRun: z.array(z.string()).optional(),
});

/** Validate package + return settlement plan preview (no money moves) */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid MissionSettlement package" }, { status: 400 });
  }

  const draft = await createSettlementDraft(parsed.data);
  if ("error" in draft) {
    return NextResponse.json({ error: draft.error, code: draft.code }, { status: 400 });
  }

  return NextResponse.json(draft);
}
