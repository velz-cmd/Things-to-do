import { AGENT_NANO_RATES, type MissionSettlementInput, type SettlementResult } from "@/lib/payment/types";
import { executeContributorBatch } from "@/lib/payment/execute";
import { executeAgentNanoPayments, totalNanoUsd } from "@/lib/payment/nano";
import { buildSettlementPlan } from "@/lib/payment/planner";
import { poolHeadline } from "@/lib/payment/pools";
import {
  createSettlementRecord,
  emitPaymentEvent,
  getNextBatchNumber,
  getSettledProofHashes,
  proofToJson,
  saveNanoPayments,
  savePaymentIntents,
  updatePaymentIntents,
  updateSettlementStatus,
} from "@/lib/payment/store";
import { settlementAuditHash, validateSettlementPackage } from "@/lib/payment/validate";

/**
 * Payment orchestrator — Stripe philosophy: only move money.
 * Intelligence Layer → MissionSettlement → this function → Arc.
 */
export async function runPaymentSettlement(
  pkg: MissionSettlementInput,
): Promise<SettlementResult | { error: string; code?: string }> {
  const existingHashes = await getSettledProofHashes();
  const validation = validateSettlementPackage(pkg, existingHashes);
  if (!validation.ok) {
    return { error: validation.message, code: validation.code };
  }

  const auditHash = settlementAuditHash(pkg);
  const batchNumber = await getNextBatchNumber();

  let settlement = await createSettlementRecord({
    package: pkg,
    status: "VALIDATING",
    poolsJson: "{}",
    auditHash,
  });

  await emitPaymentEvent(settlement.id, "MissionCreated", {
    missionId: pkg.missionId,
    treasury: pkg.treasuryAmount,
    proofHash: pkg.proofHash,
  });

  const plan = buildSettlementPlan({ settlementId: settlement.id, package: pkg });
  const poolsJson = JSON.stringify(plan.pools);

  settlement = await updateSettlementStatus(settlement.id, "ESCROW_LOCKED", {
    escrowTxHash: `escrow:${pkg.missionId}:${auditHash.slice(0, 16)}`,
    batchNumber,
    complianceJson: JSON.stringify({ pools: plan.pools, headline: poolHeadline(plan.pools) }),
  });

  await emitPaymentEvent(settlement.id, "EscrowLocked", {
    missionId: pkg.missionId,
    pools: plan.pools,
    batchNumber,
  });

  await savePaymentIntents(settlement.id, plan.intents);

  settlement = await updateSettlementStatus(settlement.id, "PROCESSING");

  const nanoPayments = await executeAgentNanoPayments({
    missionId: pkg.missionId,
    proofHash: pkg.proofHash,
    batchNumber,
    agentsRun: pkg.agentsRun,
  });
  await saveNanoPayments(settlement.id, nanoPayments);

  await emitPaymentEvent(settlement.id, "AgentNanoPaid", {
    count: nanoPayments.length,
    totalUsd: totalNanoUsd(nanoPayments),
    agents: nanoPayments.map((n) => n.agentRole),
  });

  const batch = await executeContributorBatch({
    settlementId: settlement.id,
    missionId: pkg.missionId,
    repo: pkg.repo,
    proofHash: pkg.proofHash,
    batchNumber,
    confidence: pkg.confidence,
    treasuryAmount: pkg.treasuryAmount,
    intents: plan.intents,
  });

  await updatePaymentIntents(settlement.id, batch.intents);

  const finalStatus = batch.failedWallets.length ? "FAILED" : "SETTLED";
  await updateSettlementStatus(settlement.id, finalStatus, {
    proofJson: proofToJson(batch.proof),
    complianceJson: JSON.stringify({
      pools: plan.pools,
      nanoTotal: totalNanoUsd(nanoPayments),
      failedWallets: batch.failedWallets,
    }),
  });

  await emitPaymentEvent(settlement.id, "MissionSettled", {
    batch: batchNumber,
    proof: batch.proof,
    failedWallets: batch.failedWallets,
    txHashes: batch.txHashes,
  });

  return {
    settlementId: settlement.id,
    status: finalStatus,
    plan: {
      settlementId: settlement.id,
      missionId: pkg.missionId,
      treasuryAmount: pkg.treasuryAmount,
      pools: plan.pools,
      intents: batch.intents,
      agentNanoTotal: totalNanoUsd(nanoPayments),
      contributorTotal: plan.contributorTotal,
      proofHash: pkg.proofHash,
    },
    nanoPayments,
    proof: batch.proof,
    failedWallets: batch.failedWallets,
    explorerUrls: batch.explorerUrls,
  };
}

/** Lock escrow only — preview before execute */
export async function createSettlementDraft(pkg: MissionSettlementInput) {
  const existingHashes = await getSettledProofHashes();
  const validation = validateSettlementPackage(pkg, existingHashes);
  if (!validation.ok) {
    return { error: validation.message, code: validation.code };
  }

  const auditHash = settlementAuditHash(pkg);
  const plan = buildSettlementPlan({
    settlementId: `draft-${pkg.missionId}`,
    package: pkg,
  });

  return {
    status: "READY" as const,
    missionId: pkg.missionId,
    auditHash,
    pools: plan.pools,
    intents: plan.intents,
    agentNanoEstimate: Object.values(AGENT_NANO_RATES).reduce((s, v) => s + v, 0),
    proofHash: pkg.proofHash,
    confidence: pkg.confidence,
  };
}
