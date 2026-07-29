import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";

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
});

/**
 * Legacy compatibility endpoint.
 *
 * Escrow can be recorded only after the real on-chain flow has produced a
 * confirmed Arc transaction. This endpoint intentionally creates no database
 * record, event, or synthetic transaction reference.
 */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid MissionSettlement package" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "A confirmed Arc transaction is required to lock escrow. Complete the on-chain escrow flow first.",
      code: "CONFIRMED_ARC_TRANSACTION_REQUIRED",
    },
    { status: 409 },
  );
}
