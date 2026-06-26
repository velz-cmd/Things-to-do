import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { markMissionPendingFunding } from "@/lib/authorization/ledger";
import { buildAllocationSettlementPlan } from "@/lib/payment/from-allocation";
import type { GitHubAllocationResult } from "@/lib/github/types";

const bodySchema = z.object({
  allocation: z.unknown(),
  missionId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  agentsRun: z.array(z.string()).optional(),
});

/** Payment preview — bank approval screen before execute */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocation" }, { status: 400 });
  }

  const allocation = parsed.data.allocation as unknown as GitHubAllocationResult;
  if (!allocation?.contributors?.length) {
    return NextResponse.json({ error: "No contributors in allocation" }, { status: 400 });
  }

  const confidences = allocation.contributors.flatMap((c) =>
    c.verdicts.map((v) => v.confidence),
  );
  const confidence =
    parsed.data.confidence ??
    (confidences.length ?
      confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.85);

  const plan = await buildAllocationSettlementPlan(allocation, {
    confidence,
    agentsRun: parsed.data.agentsRun,
    missionId: parsed.data.missionId,
  });

  if (plan.missionId) {
    await markMissionPendingFunding(plan.missionId).catch(() => {
      /* ledger may not be migrated yet */
    });
  }

  return NextResponse.json({
    preview: plan.preview,
    plan: {
      missionId: plan.missionId,
      readyCount: plan.ready.length,
      pendingCount: plan.pendingLogins.length,
      canExecute: plan.ready.length > 0 || plan.pendingLogins.length > 0,
    },
  });
}
