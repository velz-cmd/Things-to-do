import { deployProgramOnArc } from "@/lib/communities/deploy";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { recordPoolCheckpoint } from "@/lib/capital/pool-checkpoint-metadata";
import { debitStakePool } from "@/lib/capital/yield-service";
import { getProgram } from "@/lib/communities/programs";
import { activateCheckpointSupporterBenefits } from "@/lib/capital/supporter-benefits";

export type CheckpointSettleResult =
  | {
      ok: true;
      programId: string;
      thresholdUsd: number;
      settledUsd: number;
      settlementId?: string;
      message: string;
    }
  | { ok: false; programId: string; reason: string };

/**
 * When pool balance crosses an unpaid checkpoint and obligations exist, run a batch payout.
 * Uses existing deploy → memo → ledger fulfillment path.
 */
export async function tryCheckpointBatchSettle(
  userId: string,
  programId: string,
  opts?: { forceThresholdUsd?: number },
): Promise<CheckpointSettleResult> {
  const program = await getProgram(userId, programId);
  if (!program?.missionId) {
    return { ok: false, programId, reason: "no_mission" };
  }

  const state = await getProgramPoolState(programId, userId);
  if (!state) {
    return { ok: false, programId, reason: "not_found" };
  }

  if (!state.autoSettleEnabled && !opts?.forceThresholdUsd) {
    return { ok: false, programId, reason: "auto_disabled" };
  }

  if (state.owedToCreatorsUsd < 0.01) {
    return { ok: false, programId, reason: "no_obligations" };
  }

  if (state.availableUsd < 0.01) {
    return { ok: false, programId, reason: "pool_empty" };
  }

  if (state.owedToCreatorsUsd > state.availableUsd + 0.01) {
    return { ok: false, programId, reason: "fund_gap" };
  }

  const unpaid = state.checkpoints
    .filter((c) => c.status !== "paid")
    .sort((a, b) => a.thresholdUsd - b.thresholdUsd);

  const target =
    opts?.forceThresholdUsd != null
      ? unpaid.find((c) => c.thresholdUsd === opts.forceThresholdUsd)
      : unpaid.find((c) => state.poolBalanceUsd >= c.thresholdUsd);

  if (!target) {
    return { ok: false, programId, reason: "no_checkpoint_ready" };
  }

  const deployed = await deployProgramOnArc(userId, programId, {
    checkpointThresholdUsd: target.thresholdUsd,
  });

  if (!deployed.ok) {
    return { ok: false, programId, reason: deployed.error ?? deployed.message };
  }

  const settledUsd = deployed.settledUsd ?? state.owedToCreatorsUsd;
  await debitStakePool(programId, settledUsd).catch(() => null);

  await recordPoolCheckpoint(programId, {
    thresholdUsd: target.thresholdUsd,
    triggeredAt: new Date().toISOString(),
    settlementId: deployed.settlementId,
    paidUsd: settledUsd,
    payeeCount: deployed.payeeCount ?? 0,
    status: "paid",
  });
  await activateCheckpointSupporterBenefits(programId, target.thresholdUsd).catch((error) => {
    console.error("[checkpoint-settle] supporter benefit activation failed", error);
  });

  void import("@/lib/capital/checkpoint-funder-bonus").then((m) =>
    m
      .distributeCheckpointFunderBonus({
        programId,
        thresholdUsd: target.thresholdUsd,
        settlementId: deployed.settlementId,
      })
      .catch(() => null),
  );

  void import("@/lib/capital/deliver-funder-intel").then((m) =>
    m
      .deliverFunderIntelBrief({
        userId,
        programId,
        stakeUsd: settledUsd,
        trigger: "checkpoint",
        checkpointThresholdUsd: target.thresholdUsd,
      })
      .catch(() => null),
  );

  return {
    ok: true,
    programId,
    thresholdUsd: target.thresholdUsd,
    settledUsd,
    settlementId: deployed.settlementId,
    message: deployed.message,
  };
}

/** Scan active programs after fund/cron — best-effort checkpoint batches. */
export async function runCheckpointSettleSweep(limit = 8): Promise<CheckpointSettleResult[]> {
  const { listCheckpointSettleCandidates } = await import(
    "@/lib/capital/pool-checkpoints"
  );
  const candidates = await listCheckpointSettleCandidates(limit);
  const results: CheckpointSettleResult[] = [];

  for (const p of candidates) {
    const r = await tryCheckpointBatchSettle(p.userId, p.id).catch(
      (): CheckpointSettleResult => ({
        ok: false,
        programId: p.id,
        reason: "error",
      }),
    );
    if (r.ok) results.push(r);
  }

  return results;
}
