import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getContributorRewardSummary } from "@/lib/identity/pending-rewards";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  decayFactor,
  effectiveNotifySignal,
  type NotifyCandidate,
} from "@/lib/earn/notify-policy";

export type PayeeIdentity = {
  payeeKeyType: string;
  payeeKey: string;
  label: string;
};

export type IdentityEarnings = PayeeIdentity & {
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  verifiedUsd: number;
  authorizationCount: number;
};

export type ProfileEarningsSummary = {
  youEarnedUsd: number;
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  pendingUsd: number;
  authorizationCount: number;
  identities: IdentityEarnings[];
  stalestClaimableAt: string | null;
  notifyUrgency: number;
  githubLinked: boolean;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function resolvePayeeIdentities(
  profile: Pick<User, "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress">,
  authUser?: SupabaseUser | null,
): PayeeIdentity[] {
  const identities: PayeeIdentity[] = [];
  const seen = new Set<string>();

  const ghLogin =
    profile.githubUsername?.toLowerCase() ??
    (authUser ? extractGithubIdentity(authUser).login?.toLowerCase() : undefined);

  if (ghLogin) {
    const key = `github_username:${ghLogin}`;
    if (!seen.has(key)) {
      seen.add(key);
      identities.push({
        payeeKeyType: "github_username",
        payeeKey: ghLogin,
        label: `@${ghLogin}`,
      });
    }
  }

  const listenUser = profile.listenbrainzUsername?.trim().toLowerCase();
  if (listenUser) {
    const key = `listen_artist:${listenUser}`;
    if (!seen.has(key)) {
      seen.add(key);
      identities.push({
        payeeKeyType: "listen_artist",
        payeeKey: listenUser,
        label: listenUser,
      });
    }
  }

  const wallet =
    profile.walletAddress?.toLowerCase() ?? profile.scanWalletAddress?.toLowerCase();
  if (wallet) {
    const key = `wallet:${wallet}`;
    if (!seen.has(key)) {
      seen.add(key);
      identities.push({
        payeeKeyType: "wallet",
        payeeKey: wallet,
        label: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
      });
    }
  }

  return identities;
}

async function earningsForIdentity(identity: PayeeIdentity): Promise<IdentityEarnings> {
  if (identity.payeeKeyType === "github_username") {
    const summary = await getContributorRewardSummary(identity.payeeKey);
    return {
      ...identity,
      claimableUsd: summary.claimableUsd,
      authorizedUsd: summary.authorizedUsd,
      settledUsd: summary.settledUsd,
      verifiedUsd: summary.verifiedUsd,
      authorizationCount: summary.rewardCount,
    };
  }

  if (identity.payeeKeyType === "wallet") {
    const ledger = await getAuthorizationSummary({
      payeeKeyType: "wallet",
      payeeKey: identity.payeeKey,
    }).catch(() => null);
    const claimableUsd = ledger?.claimableUsd ?? 0;
    const authorizedUsd = (ledger?.authorizedUsd ?? 0) + (ledger?.pendingFundingUsd ?? 0);
    const settledUsd = ledger?.settledUsd ?? 0;
    return {
      ...identity,
      claimableUsd,
      authorizedUsd,
      settledUsd,
      verifiedUsd: round(claimableUsd + authorizedUsd),
      authorizationCount: ledger?.count ?? 0,
    };
  }

  const ledger = await getAuthorizationSummary({
    payeeKeyType: identity.payeeKeyType,
    payeeKey: identity.payeeKey,
  }).catch(() => null);

  const claimableUsd = ledger?.claimableUsd ?? 0;
  const authorizedUsd = (ledger?.authorizedUsd ?? 0) + (ledger?.pendingFundingUsd ?? 0);
  const settledUsd = ledger?.settledUsd ?? 0;

  return {
    ...identity,
    claimableUsd,
    authorizedUsd,
    settledUsd,
    verifiedUsd: round(claimableUsd + authorizedUsd),
    authorizationCount: ledger?.count ?? 0,
  };
}

export async function getProfileEarningsSummary(input: {
  profile: Pick<User, "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress">;
  authUser?: SupabaseUser | null;
}): Promise<ProfileEarningsSummary> {
  const identities = resolvePayeeIdentities(input.profile, input.authUser);
  const githubLinked = identities.some((i) => i.payeeKeyType === "github_username");

  if (!identities.length) {
    return {
      youEarnedUsd: 0,
      claimableUsd: 0,
      authorizedUsd: 0,
      settledUsd: 0,
      pendingUsd: 0,
      authorizationCount: 0,
      identities: [],
      stalestClaimableAt: null,
      notifyUrgency: 0,
      githubLinked: false,
    };
  }

  const identityEarnings = await Promise.all(identities.map(earningsForIdentity));

  const claimableUsd = round(identityEarnings.reduce((s, i) => s + i.claimableUsd, 0));
  const authorizedUsd = round(identityEarnings.reduce((s, i) => s + i.authorizedUsd, 0));
  const settledUsd = round(identityEarnings.reduce((s, i) => s + i.settledUsd, 0));
  const verifiedUsd = round(identityEarnings.reduce((s, i) => s + i.verifiedUsd, 0));
  const authorizationCount = identityEarnings.reduce((s, i) => s + i.authorizationCount, 0);

  const claimableRows = await prisma.paymentAuthorization.findMany({
    where: {
      status: "claimable",
      OR: identities.map((i) => ({
        payeeKeyType: i.payeeKeyType,
        payeeKey: i.payeeKey,
      })),
    },
    select: {
      amountUsd: true,
      confidence: true,
      fulfilledAt: true,
      updatedAt: true,
      createdAt: true,
    },
    take: 200,
  });

  let stalestClaimableAt: Date | null = null;
  const notifyRows: NotifyCandidate[] = [];

  for (const row of claimableRows) {
    const since = row.fulfilledAt ?? row.updatedAt ?? row.createdAt;
    if (!stalestClaimableAt || since < stalestClaimableAt) {
      stalestClaimableAt = since;
    }
    notifyRows.push({
      amountUsd: row.amountUsd,
      confidence: row.confidence,
      claimableSince: since,
    });
  }

  const grouped: NotifyCandidate | null =
    notifyRows.length > 0
      ? {
          amountUsd: round(notifyRows.reduce((s, r) => s + r.amountUsd, 0)),
          confidence:
            notifyRows.reduce((s, r) => s + r.amountUsd * r.confidence, 0) /
            notifyRows.reduce((s, r) => s + r.amountUsd, 0),
          claimableSince: stalestClaimableAt!,
        }
      : null;

  const notifyUrgency = grouped ? effectiveNotifySignal(grouped) : 0;

  return {
    youEarnedUsd: round(claimableUsd + settledUsd),
    claimableUsd,
    authorizedUsd,
    settledUsd,
    pendingUsd: round(Math.max(0, verifiedUsd - claimableUsd - settledUsd)),
    authorizationCount,
    identities: identityEarnings,
    stalestClaimableAt: stalestClaimableAt?.toISOString() ?? null,
    notifyUrgency: round(notifyUrgency),
    githubLinked,
  };
}

export function formatDecayUrgencyLabel(stalestClaimableAt: string | null): string | null {
  if (!stalestClaimableAt) return null;
  const decay = decayFactor(new Date(stalestClaimableAt));
  if (decay >= 0.75) return "Claim soon — value is fresh";
  if (decay >= 0.4) return "Claim before urgency decays";
  return "Last chance before this drops below notify threshold";
}
