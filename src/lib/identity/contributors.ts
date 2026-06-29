import { prisma } from "@/lib/db";
import { normalizePayoutCurrency, type PayoutCurrency } from "@/lib/settlement/fx";

import { normalizeGithubLogin } from "@/lib/identity/github-login";

export type ContributorStatus = "unlinked" | "claimable" | "verified" | "settled";

export function extractGithubIdentity(user: {
  user_metadata?: Record<string, unknown>;
  identities?: { provider: string; identity_data?: Record<string, unknown> }[];
}) {
  const ghIdentity = user.identities?.find((i) => i.provider === "github");
  const meta = user.user_metadata ?? {};
  const idData = ghIdentity?.identity_data ?? {};
  const rawMeta =
    (meta.raw_user_meta_data as Record<string, unknown> | undefined) ?? {};

  const rawLogin =
    (idData.login as string) ??
    (idData.user_name as string) ??
    (meta.login as string) ??
    (meta.user_name as string) ??
    (rawMeta.login as string) ??
    (rawMeta.user_name as string) ??
    null;

  const login = normalizeGithubLogin(rawLogin);

  const githubId =
    (idData.sub as string) ??
    (idData.id as string) ??
    (meta.sub as string) ??
    null;

  return { login, githubId };
}

/** Auto-register GitHub contributor — wallet optional */
export async function ensureContributorFromGithub(input: {
  login: string;
  githubId?: string | null;
  proofScore?: number;
  amountUsd?: number;
}) {
  const login = input.login.toLowerCase();
  const existing = await prisma.contributorRegistry.findFirst({
    where: { githubUsername: login },
  });

  if (existing) {
    return prisma.contributorRegistry.update({
      where: { id: existing.id },
      data: {
        githubId: input.githubId ?? existing.githubId,
        proofScore: Math.max(existing.proofScore, input.proofScore ?? 0),
        claimableUsd:
          input.amountUsd != null ?
            existing.claimableUsd + input.amountUsd
          : existing.claimableUsd,
        lastSeenAt: new Date(),
        status:
          existing.walletAddress?.match(/^0x[a-fA-F0-9]{40}$/) ?
            existing.status === "settled" ?
              "verified"
            : "verified"
          : existing.status === "unlinked" ?
            "claimable"
          : existing.status,
      },
    });
  }

  return prisma.contributorRegistry.create({
    data: {
      platform: "github",
      platformId: login,
      creatorName: login,
      githubUsername: login,
      githubId: input.githubId ?? null,
      walletAddress: null,
      verified: false,
      status: "claimable",
      proofScore: input.proofScore ?? 0,
      claimableUsd: input.amountUsd ?? 0,
      lastSeenAt: new Date(),
    },
  });
}

export async function linkWalletToGithub(input: {
  login: string;
  walletAddress: string;
  userId?: string;
}) {
  const login = input.login.toLowerCase();
  if (!input.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error("Invalid wallet address");
  }

  const contributor = await ensureContributorFromGithub({ login });

  const updated = await prisma.contributorRegistry.update({
    where: { id: contributor.id },
    data: {
      walletAddress: input.walletAddress,
      status: "verified",
      verified: true,
      lastSeenAt: new Date(),
    },
  });

  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) return updated;

    // Never replace the Circle identity wallet — payout preference only.
    const payout = input.walletAddress.toLowerCase();
    const identity = user.walletAddress?.toLowerCase();
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        githubUsername: login,
        scanWalletAddress:
          identity && payout === identity ? user.scanWalletAddress : payout,
      },
    });
  }

  return updated;
}

export async function syncUserGithubIdentity(
  userId: string,
  supabaseUser: Parameters<typeof extractGithubIdentity>[0],
) {
  const { login, githubId } = extractGithubIdentity(supabaseUser);
  if (!login) return null;

  await prisma.user.update({
    where: { id: userId },
    data: { githubUsername: login, githubId: githubId ?? undefined },
  });

  await ensureContributorFromGithub({ login, githubId });
  return login;
}

export async function getContributorByGithub(login: string) {
  return prisma.contributorRegistry.findFirst({
    where: { githubUsername: login.toLowerCase() },
  });
}

export async function getContributorPayoutPreference(login: string): Promise<PayoutCurrency> {
  const row = await getContributorByGithub(login);
  return normalizePayoutCurrency(row?.payoutCurrency);
}

export async function ensureContributorFromMusicBrainz(input: {
  mbid: string;
  artistName: string;
  email?: string | null;
}) {
  const mbid = input.mbid.toLowerCase();
  const existing = await prisma.contributorRegistry.findFirst({
    where: { musicbrainzId: mbid },
  });

  if (existing) {
    return prisma.contributorRegistry.update({
      where: { id: existing.id },
      data: {
        creatorName: input.artistName,
        platformId: input.email ?? existing.platformId,
        lastSeenAt: new Date(),
        status:
          existing.walletAddress?.match(/^0x[a-fA-F0-9]{40}$/) ?
            "verified"
          : existing.status === "unlinked" ?
            "claimable"
          : existing.status,
      },
    });
  }

  return prisma.contributorRegistry.create({
    data: {
      platform: "musicbrainz",
      platformId: input.email ?? mbid,
      creatorName: input.artistName,
      musicbrainzId: mbid,
      walletAddress: null,
      verified: false,
      status: "claimable",
      lastSeenAt: new Date(),
    },
  });
}

export async function linkWalletToMusicBrainz(input: {
  mbid: string;
  artistName: string;
  walletAddress: string;
  email?: string | null;
  userId?: string;
}) {
  const mbid = input.mbid.toLowerCase();
  if (!mbid.match(/^[a-f0-9-]{36}$/)) {
    throw new Error("Invalid MusicBrainz artist ID");
  }
  if (!input.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error("Invalid wallet address");
  }

  const contributor = await ensureContributorFromMusicBrainz({
    mbid,
    artistName: input.artistName,
    email: input.email,
  });

  const updated = await prisma.contributorRegistry.update({
    where: { id: contributor.id },
    data: {
      walletAddress: input.walletAddress,
      verified: true,
      status: "verified",
      lastSeenAt: new Date(),
      ...(input.email ? { platformId: input.email } : {}),
    },
  });

  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (user) {
      const payout = input.walletAddress.toLowerCase();
      const identity = user.walletAddress?.toLowerCase();
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          scanWalletAddress:
            identity && payout === identity ? user.scanWalletAddress : payout,
        },
      });
    }
  }

  return updated;
}

export async function getContributorByMusicBrainz(mbid: string) {
  return prisma.contributorRegistry.findFirst({
    where: { musicbrainzId: mbid.toLowerCase() },
  });
}

export async function setContributorPayoutPreference(login: string, currency: string) {
  const payoutCurrency = normalizePayoutCurrency(currency);
  const contributor = await ensureContributorFromGithub({ login });
  return prisma.contributorRegistry.update({
    where: { id: contributor.id },
    data: { payoutCurrency },
  });
}
