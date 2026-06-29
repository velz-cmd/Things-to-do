import type { User } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import {
  getAuthorizationSummary,
  getAuthorizationsForPayee,
  getClaimableAuthorizations,
} from "@/lib/authorization/ledger";
import type { GitHubAllocationResult } from "@/lib/github/types";
import { ensureContributorFromGithub } from "@/lib/identity/contributors";
import { notifyEarnAvailable } from "@/lib/earn/notify";
import { resolveClaimIdentities } from "@/lib/identity/claim-identities";

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

    const ledgerForMission = await getClaimableAuthorizations(
      "github_username",
      reward.githubUsername,
    ).then((rows) => rows.some((a) => a.missionId === reward.missionId));

    if (
      !ledgerForMission &&
      !reward.notifiedAt &&
      reward.status === "claimable" &&
      reward.amountUsd > 0
    ) {
      try {
        await notifyEarnAvailable({
          payeeKeyType: "github_username",
          payeeKey: reward.githubUsername,
          authorizationIds: [],
          amountUsd: reward.amountUsd,
          missionId: reward.missionId,
          contextLabel: reward.repo ?? undefined,
          confidence: reward.confidence,
          claimableSince: reward.createdAt,
        });
      } catch (e) {
        console.error("[pending-rewards] earn notification failed:", e);
      }
    }
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

/** Unified claim queue — every payee identity linked to the user (OSS, music, wallet). */
export async function getClaimableItemsForUser(input: {
  githubUsername?: string | null;
  walletAddress?: string | null;
  profile?: Pick<
    User,
    "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress"
  > | null;
  authUser?: SupabaseUser | null;
}) {
  const authorizations: Awaited<ReturnType<typeof getClaimableAuthorizations>> = [];
  const legacyRewards: Awaited<ReturnType<typeof getPendingRewardsForGithub>> = [];
  const seenAuth = new Set<string>();
  const seenLegacy = new Set<string>();

  const identities =
    input.profile
      ? await resolveClaimIdentities({ profile: input.profile, authUser: input.authUser })
      : [];

  if (!identities.length) {
    if (input.githubUsername) {
      identities.push({
        payeeKeyType: "github_username",
        payeeKey: input.githubUsername.toLowerCase(),
        label: `@${input.githubUsername}`,
      });
    }
    if (input.walletAddress) {
      const w = input.walletAddress.toLowerCase();
      identities.push({
        payeeKeyType: "wallet",
        payeeKey: w,
        label: `${w.slice(0, 6)}…${w.slice(-4)}`,
      });
    }
  }

  for (const identity of identities) {
    const rows = await getClaimableAuthorizations(identity.payeeKeyType, identity.payeeKey);
    for (const row of rows) {
      if (!seenAuth.has(row.id)) {
        seenAuth.add(row.id);
        authorizations.push(row);
      }
    }
  }

  const githubUsername =
    input.githubUsername ??
    identities.find((i) => i.payeeKeyType === "github_username")?.payeeKey;

  if (githubUsername) {
    const gh = await getClaimableItemsForGithub(githubUsername);
    for (const row of gh.authorizations) {
      if (!seenAuth.has(row.id)) {
        seenAuth.add(row.id);
        authorizations.push(row);
      }
    }
    for (const row of gh.legacyRewards) {
      if (!seenLegacy.has(row.id)) {
        seenLegacy.add(row.id);
        legacyRewards.push(row);
      }
    }
  }

  return { authorizations, legacyRewards, identities };
}

export async function getClaimableItemsForGithub(login: string) {
  const normalized = login.toLowerCase();
  const [authorizations, legacyRewards] = await Promise.all([
    getClaimableAuthorizations("github_username", normalized),
    getPendingRewardsForGithub(normalized),
  ]);

  const ledgerMissionIds = new Set(authorizations.map((a) => a.missionId));
  const legacyOnly = legacyRewards.filter(
    (r) => r.status === "claimable" && !ledgerMissionIds.has(r.missionId),
  );

  return { authorizations, legacyRewards: legacyOnly };
}

export async function getContributorAuthorizations(login: string) {
  return getAuthorizationsForPayee("github_username", login);
}

export async function getContributorRewardSummary(login: string) {
  const ledger = await getAuthorizationSummary({
    payeeKeyType: "github_username",
    payeeKey: login,
  }).catch(() => null);

  const rewards = await prisma.pendingReward.findMany({
    where: { githubUsername: login.toLowerCase() },
  });

  const settled = await prisma.paymentIntent.findMany({
    where: {
      login: { equals: login, mode: "insensitive" },
      status: "settled",
    },
  });

  const claimableFromLedger = ledger?.claimableUsd ?? 0;
  const authorizedFromLedger =
    (ledger?.authorizedUsd ?? 0) + (ledger?.pendingFundingUsd ?? 0);

  const claimable = Math.max(
    claimableFromLedger,
    rewards.filter((r) => r.status === "claimable").reduce((s, r) => s + r.amountUsd, 0),
  );
  const authorized = Math.max(
    authorizedFromLedger,
    rewards
      .filter((r) => r.status === "authorized" || r.status === "pending_funding")
      .reduce((s, r) => s + r.amountUsd, 0),
  );
  const pending = rewards
    .filter((r) => r.status === "claimed")
    .reduce((s, r) => s + r.amountUsd, 0);
  const settledUsd = Math.max(
    ledger?.settledUsd ?? 0,
    settled.reduce((s, r) => s + r.amountUsd, 0),
  );

  return {
    claimableUsd: Math.round(claimable * 100) / 100,
    authorizedUsd: Math.round(authorized * 100) / 100,
    pendingUsd: Math.round(pending * 100) / 100,
    settledUsd: Math.round(settledUsd * 100) / 100,
    verifiedUsd: Math.round((claimable + authorized + pending) * 100) / 100,
    rewardCount: Math.max(ledger?.count ?? 0, rewards.length),
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
