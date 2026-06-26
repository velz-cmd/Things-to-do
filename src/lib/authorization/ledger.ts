import { prisma } from "@/lib/db";
import type { GitHubAllocationResult } from "@/lib/github/types";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";

/** Authorization lifecycle — engineering term from Distribution Bootstrap Part 2. */
export type AuthorizationStatus =
  | "authorized"
  | "pending_funding"
  | "claimable"
  | "claimed"
  | "settled"
  | "cancelled";

export function missionIdForAllocation(allocation: GitHubAllocationResult): string {
  const stamp = allocation.evaluatedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `gh-${allocation.owner}-${allocation.repo}-${stamp}`;
}

/** Record authorizations when value is recognized (analyze), before settlement. */
export async function recordAuthorizationsFromAllocation(
  allocation: GitHubAllocationResult,
  options?: { confidence?: number; founderUserId?: string },
) {
  const missionId = missionIdForAllocation(allocation);
  const confidence = options?.confidence ?? 0.85;
  const repo = `${allocation.owner}/${allocation.repo}`;
  const created = [];

  for (const c of allocation.contributors) {
    await ensureContributorFromGithub({
      login: c.login,
      proofScore: c.trustScore,
      amountUsd: c.payoutUsd,
    });

    const row = await prisma.pendingReward.upsert({
      where: {
        missionId_githubUsername: {
          missionId,
          githubUsername: c.login.toLowerCase(),
        },
      },
      create: {
        missionId,
        repo,
        githubUsername: c.login.toLowerCase(),
        amountUsd: c.payoutUsd,
        weight: c.totalWeight,
        proofHash: allocation.weightProofHash,
        confidence,
        status: "authorized",
        founderUserId: options?.founderUserId,
      },
      update: {
        amountUsd: c.payoutUsd,
        weight: c.totalWeight,
        proofHash: allocation.weightProofHash,
        confidence,
        status: "authorized",
      },
    });
    created.push(row);
  }

  return { missionId, authorizations: created };
}

export async function markAuthorizationsPendingFunding(missionId: string) {
  return prisma.pendingReward.updateMany({
    where: { missionId, status: "authorized" },
    data: { status: "pending_funding" },
  });
}

export async function getAuthorizationSummaryForRepo(owner: string, repo: string) {
  const prefix = `gh-${owner}-${repo}-`;
  const rows = await prisma.pendingReward.findMany({
    where: { missionId: { startsWith: prefix } },
    orderBy: { updatedAt: "desc" },
  });

  const byLogin = new Map<string, (typeof rows)[0]>();
  for (const r of rows) {
    const existing = byLogin.get(r.githubUsername);
    if (!existing || r.updatedAt > existing.updatedAt) {
      byLogin.set(r.githubUsername, r);
    }
  }

  const latest = [...byLogin.values()];
  const authorizedUsd = latest
    .filter((r) => r.status === "authorized" || r.status === "pending_funding")
    .reduce((s, r) => s + r.amountUsd, 0);
  const claimableUsd = latest
    .filter((r) => r.status === "claimable")
    .reduce((s, r) => s + r.amountUsd, 0);
  const settledUsd = latest
    .filter((r) => r.status === "settled")
    .reduce((s, r) => s + r.amountUsd, 0);

  return {
    missionId: latest[0]?.missionId ?? null,
    contributorCount: latest.length,
    authorizedUsd: Math.round(authorizedUsd * 100) / 100,
    claimableUsd: Math.round(claimableUsd * 100) / 100,
    settledUsd: Math.round(settledUsd * 100) / 100,
    contributors: latest.map((r) => ({
      login: r.githubUsername,
      amountUsd: r.amountUsd,
      status: r.status as AuthorizationStatus,
    })),
  };
}
