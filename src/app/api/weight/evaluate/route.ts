import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateImpactWeights } from "@/lib/weight/evaluate";
import type { DistributionPlatform } from "@/lib/gateway/types";

const bodySchema = z.object({
  platform: z.enum([
    "navidrome",
    "owncast",
    "immich",
    "mastodon",
    "jellyfin",
    "github",
    "generic",
  ]),
  events: z.array(
    z.object({
      eventId: z.string(),
      type: z.string(),
      platformId: z.string().optional(),
      amountUsd: z.number().min(0),
      payload: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
  fundPoolUsd: z.number().positive(),
});

/** Proof-of-Weight engine — scores contribution impact before settlement. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid weight evaluation payload" }, { status: 400 });
  }

  const evaluation = await evaluateImpactWeights({
    platform: parsed.data.platform as DistributionPlatform,
    events: parsed.data.events,
    fundPoolUsd: parsed.data.fundPoolUsd,
  });

  return NextResponse.json(evaluation);
}

export async function GET() {
  return NextResponse.json({
    name: "RESOLVE Proof-of-Weight Engine",
    description: "Impact-weighted distribution — who deserves how much, before money moves",
    signals: [
      "engagement_depth",
      "contribution_complexity",
      "consistency",
      "community_endorsement",
      "proof_integrity",
      "reach_proxy",
      "suspicion_penalty",
    ],
    methodology: "/methodology",
    endpoint: "POST /api/weight/evaluate",
  });
}
