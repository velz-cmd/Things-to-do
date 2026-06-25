import type { GitHubAllocationResult } from "@/lib/github/types";
import type { MissionSettlementInput } from "@/lib/payment/types";
import { prisma } from "@/lib/db";

/** Bridge Intelligence Layer → Payment Layer (one direction only) */
export async function allocationToMissionSettlement(
  allocation: GitHubAllocationResult,
  options?: { confidence?: number; agentsRun?: string[] },
): Promise<MissionSettlementInput | { error: string; missingWallets: string[] }> {
  const missingWallets: string[] = [];
  const contributors = [];

  for (const c of allocation.contributors) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { githubUsername: c.login },
    });
    const wallet = row?.walletAddress;
    if (!wallet?.match(/^0x[a-fA-F0-9]{40}$/)) {
      missingWallets.push(c.login);
      continue;
    }
    contributors.push({
      wallet,
      login: c.login,
      weight: c.totalWeight,
      amount: c.payoutUsd.toFixed(2),
      rank: allocation.contributors.indexOf(c) + 1,
    });
  }

  if (!contributors.length) {
    return {
      error: "No contributors with registered wallets",
      missingWallets,
    };
  }

  if (missingWallets.length) {
    return { error: `Missing wallets for: ${missingWallets.join(", ")}`, missingWallets };
  }

  const missionId = `gh-${allocation.owner}-${allocation.repo}-${Date.now()}`;

  return {
    missionId,
    repo: `${allocation.owner}/${allocation.repo}`,
    treasuryAmount: allocation.fundPoolUsd,
    currency: "USDC",
    confidence: options?.confidence ?? 0.85,
    proofHash: allocation.weightProofHash,
    contributors,
    createdAt: allocation.evaluatedAt,
    agentsRun: options?.agentsRun,
  };
}
