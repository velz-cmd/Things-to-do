import { AGENT_NANO_RATES, type MissionSettlementInput, type SettlementResult } from "@/lib/payment/types";
import { executeContributorBatch } from "@/lib/payment/execute";
import { executeAgentNanoPayments, totalNanoUsd } from "@/lib/payment/nano";
import { buildSettlementPlan } from "@/lib/payment/planner";
import { poolHeadline } from "@/lib/payment/pools";
import { reserveCapitalPools } from "@/lib/payment/pools";
import { createPendingRewardsFromAllocation } from "@/lib/identity/pending-rewards";
import type { GitHubAllocationResult } from "@/lib/github/types";
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
  options?: {
    allocation?: GitHubAllocationResult;
    pendingLogins?: string[];
    founderUserId?: string;
    preview?: import("@/lib/payment/preview").PaymentPreview;
  },
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
    pendingClaimUsd: pkg.pendingClaimUsd ?? 0,
  });

  let pendingRewards: { login: string; amountUsd: number }[] = [];
  if (options?.allocation && options.pendingLogins?.length) {
    const rewards = await createPendingRewardsFromAllocation({
      allocation: options.allocation,
      missionId: pkg.missionId,
      confidence: pkg.confidence,
      founderUserId: options.founderUserId,
      pendingLogins: options.pendingLogins,
      settlementId: settlement.id,
    });
    pendingRewards = rewards.map((r) => ({
      login: r.githubUsername,
      amountUsd: r.amountUsd,
    }));

    await emitPaymentEvent(settlement.id, "ClaimRequired", {
      count: pendingRewards.length,
      totalUsd: pendingRewards.reduce((s, r) => s + r.amountUsd, 0),
      logins: pendingRewards.map((r) => r.login),
    });
  }

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
    pendingRewards,
    preview: options?.preview,
  };
}

/** Mission locked — all rewards pending claim (no wallets ready yet) */
export async function runPendingOnlyMission(input: {
  missionId: string;
  repo: string;
  proofHash: string;
  confidence: number;
  treasuryAmount: number;
  pendingClaimUsd: number;
  allocation: GitHubAllocationResult;
  pendingLogins: string[];
  founderUserId?: string;
  preview?: import("@/lib/payment/preview").PaymentPreview;
}): Promise<SettlementResult | { error: string; code?: string }> {
  const pkg: MissionSettlementInput = {
    missionId: input.missionId,
    repo: input.repo,
    treasuryAmount: input.pendingClaimUsd,
    currency: "USDC",
    confidence: input.confidence,
    proofHash: input.proofHash,
    contributors: [],
    pendingClaimUsd: input.pendingClaimUsd,
  };

  const existingHashes = await getSettledProofHashes();
  const validation = validateSettlementPackage(pkg, existingHashes);
  if (!validation.ok) {
    return { error: validation.message, code: validation.code };
  }

  const auditHash = settlementAuditHash(pkg);
  const batchNumber = await getNextBatchNumber();
  const pools = reserveCapitalPools(input.treasuryAmount);

  let settlement = await createSettlementRecord({
    package: { ...pkg, treasuryAmount: input.treasuryAmount },
    status: "ESCROW_LOCKED",
    poolsJson: JSON.stringify(pools),
    auditHash,
  });

  await updateSettlementStatus(settlement.id, "ESCROW_LOCKED", {
    escrowTxHash: `escrow:${input.missionId}:${auditHash.slice(0, 16)}`,
    batchNumber,
    complianceJson: JSON.stringify({
      pools,
      pendingOnly: true,
      pendingClaimUsd: input.pendingClaimUsd,
    }),
  });

  await emitPaymentEvent(settlement.id, "EscrowLocked", {
    missionId: input.missionId,
    pendingOnly: true,
    pendingClaimUsd: input.pendingClaimUsd,
  });

  const rewards = await createPendingRewardsFromAllocation({
    allocation: input.allocation,
    missionId: input.missionId,
    confidence: input.confidence,
    founderUserId: input.founderUserId,
    pendingLogins: input.pendingLogins,
    settlementId: settlement.id,
  });

  await emitPaymentEvent(settlement.id, "ClaimRequired", {
    count: rewards.length,
    totalUsd: input.pendingClaimUsd,
    logins: input.pendingLogins,
  });

  const pendingRewards = rewards.map((r) => ({
    login: r.githubUsername,
    amountUsd: r.amountUsd,
  }));

  return {
    settlementId: settlement.id,
    status: "READY",
    plan: {
      settlementId: settlement.id,
      missionId: input.missionId,
      treasuryAmount: input.treasuryAmount,
      pools,
      intents: [],
      agentNanoTotal: 0,
      contributorTotal: 0,
      proofHash: input.proofHash,
    },
    nanoPayments: [],
    failedWallets: [],
    explorerUrls: [],
    pendingRewards,
    preview: input.preview,
  };
}

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
