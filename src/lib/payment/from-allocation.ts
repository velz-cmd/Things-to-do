import type { GitHubAllocationResult } from "@/lib/github/types";
import type { MissionSettlementInput } from "@/lib/payment/types";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";
import { buildPaymentPreview, type PaymentPreview } from "@/lib/payment/preview";

export interface AllocationSettlementPlan {
  missionId: string;
  repo: string;
  treasuryAmount: number;
  confidence: number;
  proofHash: string;
  ready: MissionSettlementInput["contributors"];
  pendingLogins: string[];
  preview: PaymentPreview;
  package?: MissionSettlementInput;
}

/** Bridge Intelligence Layer → Payment Layer. Wallets optional — pending rewards for unlinked. */
export async function buildAllocationSettlementPlan(
  allocation: GitHubAllocationResult,
  options?: { confidence?: number; agentsRun?: string[]; missionId?: string },
): Promise<AllocationSettlementPlan> {
  const missionId =
    options?.missionId ??
    `gh-${allocation.owner}-${allocation.repo}-${Date.now()}`;
  const confidence = options?.confidence ?? 0.85;

  const ready: MissionSettlementInput["contributors"] = [];
  const pendingLogins: string[] = [];

  for (const c of allocation.contributors) {
    await ensureContributorFromGithub({
      login: c.login,
      proofScore: c.trustScore,
    });

    const row = await ensureContributorFromGithub({ login: c.login });
    const wallet = row.walletAddress;

    if (wallet?.match(/^0x[a-fA-F0-9]{40}$/)) {
      ready.push({
        wallet,
        login: c.login,
        weight: c.totalWeight,
        amount: c.payoutUsd.toFixed(2),
        rank: allocation.contributors.indexOf(c) + 1,
      });
    } else {
      pendingLogins.push(c.login);
    }
  }

  const preview = await buildPaymentPreview({
    allocation,
    missionId,
    confidence,
    agentsRun: options?.agentsRun,
  });

  const readyTotal = ready.reduce((s, c) => s + Number(c.amount), 0);
  const pendingTotal = pendingLogins.reduce((s, login) => {
    const c = allocation.contributors.find((x) => x.login === login);
    return s + (c?.payoutUsd ?? 0);
  }, 0);

  const tolerance = 0.05;
  if (Math.abs(readyTotal + pendingTotal - allocation.fundPoolUsd) > tolerance) {
    throw new Error("Allocation sum mismatch");
  }

  const plan: AllocationSettlementPlan = {
    missionId,
    repo: `${allocation.owner}/${allocation.repo}`,
    treasuryAmount: allocation.fundPoolUsd,
    confidence,
    proofHash: allocation.weightProofHash,
    ready,
    pendingLogins,
    preview,
  };

  if (ready.length) {
    plan.package = {
      missionId,
      repo: plan.repo,
      treasuryAmount: readyTotal,
      currency: "USDC",
      confidence,
      proofHash: allocation.weightProofHash,
      contributors: ready,
      createdAt: allocation.evaluatedAt,
      agentsRun: options?.agentsRun,
      pendingClaimUsd: pendingTotal,
    };
  }

  return plan;
}

/** @deprecated Use buildAllocationSettlementPlan */
export async function allocationToMissionSettlement(
  allocation: GitHubAllocationResult,
  options?: { confidence?: number; agentsRun?: string[] },
): Promise<MissionSettlementInput | { error: string; missingWallets: string[] }> {
  const plan = await buildAllocationSettlementPlan(allocation, options);
  if (!plan.package) {
    return {
      error: "No contributors with wallets — pending rewards created for claim portal",
      missingWallets: plan.pendingLogins,
    };
  }
  if (plan.pendingLogins.length) {
    return plan.package;
  }
  return plan.package;
}
