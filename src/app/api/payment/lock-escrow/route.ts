import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { createSettlementDraft } from "@/lib/payment/orchestrator";
import {
  createSettlementRecord,
  emitPaymentEvent,
  updateSettlementStatus,
} from "@/lib/payment/store";
import { settlementAuditHash } from "@/lib/payment/validate";
import { buildSettlementPlan } from "@/lib/payment/planner";
import { poolHeadline } from "@/lib/payment/pools";

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

/** Validate package, lock escrow, return READY settlement (no contributor payouts yet) */
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

  const auditHash = settlementAuditHash(parsed.data);
  const plan = buildSettlementPlan({
    settlementId: `lock-${parsed.data.missionId}`,
    package: parsed.data,
  });

  const settlement = await createSettlementRecord({
    package: parsed.data,
    status: "ESCROW_LOCKED",
    poolsJson: JSON.stringify(plan.pools),
    auditHash,
  });

  await updateSettlementStatus(settlement.id, "ESCROW_LOCKED", {
    escrowTxHash: `escrow:${parsed.data.missionId}:${auditHash.slice(0, 16)}`,
    complianceJson: JSON.stringify({ pools: plan.pools, headline: poolHeadline(plan.pools) }),
  });

  await emitPaymentEvent(settlement.id, "EscrowLocked", {
    missionId: parsed.data.missionId,
    pools: plan.pools,
    status: "READY",
  });

  return NextResponse.json({
    settlementId: settlement.id,
    status: "READY",
    missionId: parsed.data.missionId,
    auditHash,
    pools: draft.pools,
    intents: draft.intents,
    proofHash: parsed.data.proofHash,
  });
}
