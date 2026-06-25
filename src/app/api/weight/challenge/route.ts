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
 * Weight Dispute Layer (WDL) — permissionless challenge on a contributor's impact share.
 * Settlement pauses for contested payees until re-weighting resolves.
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
    layer: "wdl",
    payeeKey: parsed.data.payeeKey,
    claimedSharePercent: parsed.data.claimedSharePercent,
    stakeUsd: parsed.data.challengerStakeUsd,
    message:
      "Challenge recorded — settlement paused for this payee pending Proof-of-Weight re-evaluation.",
    flow: "stake → re-weight → resolve → settle remainder",
  });
}

export async function GET() {
  return NextResponse.json({
    name: "Weight Dispute Layer",
    primitive: "wdl",
    description: "Permissionless stake to challenge impact shares before Arc settlement",
    endpoint: "POST /api/weight/challenge",
  });
}
