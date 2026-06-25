import { prisma } from "@/lib/db";
import type { GitHubAllocationResult } from "@/lib/github/types";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";

export type PendingRewardStatus = "claimable" | "claimed" | "settled" | "cancelled";

export async function createPendingRewardsFromAllocation(input: {
  allocation: GitHubAllocationResult;
  missionId: string;
  confidence: number;
  founderUserId?: string;
  pendingLogins: string[];
  settlementId?: string;
}) {
  const created = [];

  for (const login of input.pendingLogins) {
    const contributor = input.allocation.contributors.find(
      (c) => c.login.toLowerCase() === login.toLowerCase(),
    );
    if (!contributor) continue;

    await ensureContributorFromGithub({
      login: contributor.login,
      proofScore: contributor.trustScore,
      amountUsd: contributor.payoutUsd,
    });

    const reward = await prisma.pendingReward.upsert({
      where: {
        missionId_githubUsername: {
          missionId: input.missionId,
          githubUsername: contributor.login.toLowerCase(),
        },
      },
      create: {
        missionId: input.missionId,
        repo: `${input.allocation.owner}/${input.allocation.repo}`,
        githubUsername: contributor.login.toLowerCase(),
        amountUsd: contributor.payoutUsd,
        weight: contributor.totalWeight,
        proofHash: input.allocation.weightProofHash,
        confidence: input.confidence,
        status: "claimable",
        founderUserId: input.founderUserId,
        settlementId: input.settlementId,
      },
      update: {
        amountUsd: contributor.payoutUsd,
        weight: contributor.totalWeight,
        confidence: input.confidence,
        status: "claimable",
        settlementId: input.settlementId ?? undefined,
      },
    });

    created.push(reward);
  }

  return created;
}

export async function getPendingRewardsForGithub(login: string) {
  return prisma.pendingReward.findMany({
    where: {
      githubUsername: login.toLowerCase(),
      status: { in: ["claimable", "claimed"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContributorRewardSummary(login: string) {
  const rewards = await prisma.pendingReward.findMany({
    where: { githubUsername: login.toLowerCase() },
  });

  const settled = await prisma.paymentIntent.findMany({
    where: {
      login: { equals: login, mode: "insensitive" },
      status: "settled",
    },
  });

  const claimable = rewards
    .filter((r) => r.status === "claimable")
    .reduce((s, r) => s + r.amountUsd, 0);
  const pending = rewards
    .filter((r) => r.status === "claimed")
    .reduce((s, r) => s + r.amountUsd, 0);
  const settledUsd = settled.reduce((s, r) => s + r.amountUsd, 0);

  return {
    claimableUsd: Math.round(claimable * 100) / 100,
    pendingUsd: Math.round(pending * 100) / 100,
    settledUsd: Math.round(settledUsd * 100) / 100,
    verifiedUsd: Math.round((claimable + pending) * 100) / 100,
    rewardCount: rewards.length,
  };
}

export async function markRewardSettled(rewardId: string, input: {
  walletAddress: string;
  settlementId?: string;
  txHash?: string;
}) {
  return prisma.pendingReward.update({
    where: { id: rewardId },
    data: {
      status: "settled",
      walletAddress: input.walletAddress,
      settlementId: input.settlementId,
      settledAt: new Date(),
      claimedAt: new Date(),
    },
  });
}
