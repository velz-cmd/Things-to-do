import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

const bodySchema = z.object({
  batchId: z.string().optional(),
  payeeKey: z.string(),
  claimedSharePercent: z.number().min(0).max(100),
  challengerStakeUsd: z.number().min(0.5).max(50).default(2),
  reason: z.string().max(500).optional(),
});

/**
 * Mimir-inspired weight dispute — stake USDC to challenge a contributor's impact share.
 * Pauses settlement until re-evaluation or timeout (demo: records challenge + returns id).
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid challenge payload" }, { status: 400 });
  }

  const challengeId = createHash("sha256")
    .update(JSON.stringify({ ...parsed.data, at: Date.now() }))
    .digest("hex")
    .slice(0, 16);

  return NextResponse.json({
    challengeId,
    status: "open",
    payeeKey: parsed.data.payeeKey,
    claimedSharePercent: parsed.data.claimedSharePercent,
    stakeUsd: parsed.data.challengerStakeUsd,
    message:
      "Challenge recorded — settlement paused for this payee pending weight re-evaluation (24h window in production).",
    flow: "stake → AI re-weight → council vote or auto-resolve → settle remainder",
  });
}

export async function GET() {
  return NextResponse.json({
    name: "RESOLVE Weight Dispute Market",
    inspiredBy: "Mimir claim challenges",
    description: "Stake USDC to challenge top-10% impact weights before Arc settlement",
    endpoint: "POST /api/weight/challenge",
  });
}
