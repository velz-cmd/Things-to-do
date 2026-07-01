import { prisma } from "@/lib/db";
import { isMissingTableError } from "@/lib/db/prisma-errors";
import type { User } from "@prisma/client";
import {
  getProfileEarningsSummary,
  type ProfileEarningsSummary,
  type IdentityEarnings,
} from "@/lib/earn/summary";

const SNAPSHOT_TTL_MS = 5 * 60_000;

function snapshotToSummary(row: {
  youEarnedUsd: number;
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  pendingUsd: number;
  authorizationCount: number;
  identitiesJson: string;
  stalestClaimableAt: Date | null;
  notifyUrgency: number;
  githubLinked: boolean;
  computedAt: Date;
}): ProfileEarningsSummary {
  let identities: IdentityEarnings[] = [];
  try {
    identities = JSON.parse(row.identitiesJson) as IdentityEarnings[];
  } catch {
    identities = [];
  }
  return {
    youEarnedUsd: row.youEarnedUsd,
    claimableUsd: row.claimableUsd,
    authorizedUsd: row.authorizedUsd,
    settledUsd: row.settledUsd,
    pendingUsd: row.pendingUsd,
    authorizationCount: row.authorizationCount,
    identities,
    stalestClaimableAt: row.stalestClaimableAt?.toISOString() ?? null,
    notifyUrgency: row.notifyUrgency,
    githubLinked: row.githubLinked,
  };
}

export async function refreshUserEarningsSnapshot(
  userId: string,
  profile: Pick<User, "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress">,
): Promise<ProfileEarningsSummary> {
  const summary = await getProfileEarningsSummary({ profile });

  try {
    await prisma.userEarningsSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      youEarnedUsd: summary.youEarnedUsd,
      claimableUsd: summary.claimableUsd,
      authorizedUsd: summary.authorizedUsd,
      settledUsd: summary.settledUsd,
      pendingUsd: summary.pendingUsd,
      authorizationCount: summary.authorizationCount,
      identitiesJson: JSON.stringify(summary.identities),
      stalestClaimableAt: summary.stalestClaimableAt
        ? new Date(summary.stalestClaimableAt)
        : null,
      notifyUrgency: summary.notifyUrgency,
      githubLinked: summary.githubLinked,
      computedAt: new Date(),
    },
    update: {
      youEarnedUsd: summary.youEarnedUsd,
      claimableUsd: summary.claimableUsd,
      authorizedUsd: summary.authorizedUsd,
      settledUsd: summary.settledUsd,
      pendingUsd: summary.pendingUsd,
      authorizationCount: summary.authorizationCount,
      identitiesJson: JSON.stringify(summary.identities),
      stalestClaimableAt: summary.stalestClaimableAt
        ? new Date(summary.stalestClaimableAt)
        : null,
      notifyUrgency: summary.notifyUrgency,
      githubLinked: summary.githubLinked,
      computedAt: new Date(),
    },
    });
  } catch (e) {
    if (!isMissingTableError(e)) throw e;
  }

  return summary;
}

/** Fast path for profile bootstrap — snapshot when fresh, else recompute once. */
export async function getProfileEarningsSummaryCached(input: {
  userId: string;
  profile: Pick<User, "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress">;
  maxAgeMs?: number;
}): Promise<ProfileEarningsSummary> {
  const maxAge = input.maxAgeMs ?? SNAPSHOT_TTL_MS;
  try {
    const row = await prisma.userEarningsSnapshot.findUnique({
      where: { userId: input.userId },
    });

    if (row && Date.now() - row.computedAt.getTime() < maxAge) {
      return snapshotToSummary(row);
    }
  } catch (e) {
    if (!isMissingTableError(e)) throw e;
  }

  return refreshUserEarningsSnapshot(input.userId, input.profile);
}

/** Cron — refresh snapshots for users with recent ledger activity. */
export async function refreshStaleEarningsSnapshots(limit = 48): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const payees = await prisma.paymentAuthorization.findMany({
    where: { updatedAt: { gte: since } },
    select: { payeeKey: true, payeeKeyType: true },
    distinct: ["payeeKey", "payeeKeyType"],
    take: limit * 3,
  });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { githubUsername: { not: null } },
        { listenbrainzUsername: { not: null } },
        { walletAddress: { not: null } },
        { scanWalletAddress: { not: null } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  let count = 0;
  for (const user of users) {
    await refreshUserEarningsSnapshot(user.id, user).catch(() => null);
    count += 1;
  }
  void payees;
  return count;
}
