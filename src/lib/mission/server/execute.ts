import { allocateGithubPool } from "@/lib/github/allocate";
import {
  buildAllocationSettlementPlan,
} from "@/lib/payment/from-allocation";
import { assertTreasuryCanFund, TreasuryUnderfundedError } from "@/lib/treasury/engine";
import { runPaymentSettlement, runPendingOnlyMission } from "@/lib/payment/orchestrator";
import { markMissionPendingFunding } from "@/lib/authorization/ledger";
import { updateMissionStatus } from "@/lib/mission/server/missions";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import type { GitHubAllocationResult } from "@/lib/github/types";

export async function executeMissionAllocation(input: {
  userId: string;
  missionId: string;
  owner: string;
  repo: string;
  fundPoolUsd: number;
  dryRun?: boolean;
  execute?: boolean;
}) {
  await updateMissionStatus(input.userId, input.missionId, "executing", "Running community capital allocation");

  const allocation = await allocateGithubPool({
    owner: input.owner,
    repo: input.repo,
    fundPoolUsd: input.fundPoolUsd,
    useLlm: true,
  });

  if ("error" in allocation) {
    await updateMissionStatus(input.userId, input.missionId, "failed", allocation.error);
    return { ok: false as const, error: allocation.error };
  }

  const plan = await buildAllocationSettlementPlan(allocation, {
    missionId: input.missionId,
    confidence: 0.9,
  });

  if (input.dryRun || !input.execute) {
    await updateMissionStatus(
      input.userId,
      input.missionId,
      "awaiting_user",
      `Allocation prepared for ${plan.repo}`,
    );
    return {
      ok: true as const,
      dryRun: true,
      plan: {
        missionId: plan.missionId,
        repo: plan.repo,
        treasuryAmount: plan.treasuryAmount,
        readyCount: plan.ready.length,
        pendingCount: plan.pendingLogins.length,
        preview: plan.preview,
      },
      allocation,
    };
  }

  try {
    await assertTreasuryCanFund(plan.treasuryAmount);
  } catch (e) {
    const msg = e instanceof TreasuryUnderfundedError ? e.message : "Treasury underfunded";
    await updateMissionStatus(input.userId, input.missionId, "failed", msg);
    return { ok: false as const, error: msg, plan };
  }

  await markMissionPendingFunding(plan.missionId).catch(() => undefined);

  const settlement =
    plan.package ?
      await runPaymentSettlement(plan.package, {
        allocation,
        pendingLogins: plan.pendingLogins,
        founderUserId: input.userId,
        preview: plan.preview,
      })
    : await runPendingOnlyMission({
        missionId: plan.missionId,
        repo: plan.repo,
        proofHash: plan.proofHash,
        confidence: plan.confidence,
        treasuryAmount: plan.treasuryAmount,
        pendingClaimUsd: plan.preview.pendingClaimUsd,
        allocation,
        pendingLogins: plan.pendingLogins,
        founderUserId: input.userId,
        preview: plan.preview,
      });

  await updateMissionStatus(input.userId, input.missionId, "completed", "Settlement initiated");
  const settlementId =
    settlement && "settlementId" in settlement ? settlement.settlementId : undefined;

  await recordTimelineEvent({
    userId: input.userId,
    missionId: input.missionId,
    eventType: "settlement_executed",
    title: `Settlement · ${plan.repo}`,
    detail: `$${plan.treasuryAmount.toFixed(2)} across ${plan.ready.length + plan.pendingLogins.length} recipients`,
    severity: "info",
    metadata: { settlementId },
  });

  return { ok: true as const, dryRun: false, plan, settlement, allocation };
}

export function allocationFromOpportunities(
  opportunities: Array<{ owner: string; repo: string; health: { fundingGapUsd: number } }>,
  totalUsd: number,
): { owner: string; repo: string; amountUsd: number }[] {
  const gapTotal = opportunities.reduce((s, o) => s + o.health.fundingGapUsd, 0) || 1;
  return opportunities.map((o) => ({
    owner: o.owner,
    repo: o.repo,
    amountUsd: Math.round((o.health.fundingGapUsd / gapTotal) * totalUsd),
  }));
}

export type { GitHubAllocationResult };
