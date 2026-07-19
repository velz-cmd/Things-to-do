import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import {
  userJellyfinConfigured,
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";
import { safeUrlHostname } from "@/lib/profile/safe-url";
import type {
  ConnectionSyncStatus,
  PlatformConnection,
  UserConnectionState,
} from "@/lib/profile/connection-state-types";

function persistedStatus(value: string): ConnectionSyncStatus {
  const status = value.trim().toLowerCase();
  if (["connected", "healthy", "completed"].includes(status)) return "connected";
  if (["syncing", "fetching", "queued", "pending"].includes(status)) return "syncing";
  if (status === "stale") return "stale";
  if (["expired", "reconnect_required"].includes(status)) return "reconnect_required";
  if (["failed", "sync_failed"].includes(status)) return "failed";
  if (status === "error") return "error";
  return "not_connected";
}

async function musicbrainzLinked(walletAddress: string | null): Promise<{
  connected: boolean;
  displayValue?: string;
}> {
  if (!walletAddress || !process.env.DATABASE_URL) {
    return { connected: false };
  }
  const rows = await prisma.contributorRegistry.findMany({
    where: {
      walletAddress: walletAddress.toLowerCase(),
      exifArtist: { not: null },
      status: { in: ["linked", "verified"] },
    },
    take: 3,
    select: { exifArtist: true },
  });
  if (rows.length === 0) return { connected: false };
  const names = rows.map((r) => r.exifArtist).filter(Boolean) as string[];
  return {
    connected: true,
    displayValue: names.length === 1 ? names[0] : `${names.length} artist names`,
  };
}

export async function getUserConnectionState(input: {
  userId: string;
  profile: Pick<
    User,
    | "githubUsername"
    | "listenbrainzUsername"
    | "jellyfinUrl"
    | "jellyfinUsername"
    | "jellyfinAccessToken"
    | "jellyfinPassword"
    | "navidromeUrl"
    | "navidromeUsername"
    | "navidromePassword"
    | "gmailConnected"
    | "walletAddress"
    | "scanWalletAddress"
    | "updatedAt"
  >;
  walletAddress?: string;
  fast?: boolean;
}): Promise<UserConnectionState> {
  const githubUsername = normalizeGithubLogin(input.profile.githubUsername);
  const listenbrainzConnected = userListenBrainzConfigured(input.profile);
  const navidromeConnected = userNavidromeConfigured(input.profile);
  const jellyfinConnected = userJellyfinConfigured(input.profile);
  const appWallet = input.profile.walletAddress?.trim().toLowerCase() ?? null;
  const externalWallet = input.profile.scanWalletAddress?.trim().toLowerCase() ?? null;
  const wallet =
    appWallet ??
    externalWallet ??
    input.walletAddress?.trim().toLowerCase() ??
    null;

  const [installs, mbLink, sourceRows, payoutDestination] = await Promise.all([
    prisma.resolveCommunityInstall
      .findMany({
        where: { userId: input.userId },
        select: { communitySlug: true },
      })
      .catch(() => []),
    input.fast
      ? Promise.resolve({ connected: false as const })
      : musicbrainzLinked(wallet),
    prisma.sourceConnection.findMany({
      where: { userId: input.userId },
      select: {
        provider: true,
        displayLabel: true,
        externalAccountId: true,
        status: true,
        lastSyncedAt: true,
        authExpiresAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }).catch(() => []),
    prisma.payoutDestination.findFirst({
      where: { userId: input.userId },
      select: { address: true, status: true, updatedAt: true },
      orderBy: [{ verifiedAt: "desc" }, { updatedAt: "desc" }],
    }).catch(() => null),
  ]);

  const sourceByProvider = new Map<string, (typeof sourceRows)[number]>();
  for (const row of sourceRows) {
    const provider = row.provider.toLowerCase();
    if (!sourceByProvider.has(provider)) sourceByProvider.set(provider, row);
  }

  const installedCommunitySlugs = installs.map((i) => i.communitySlug);
  const navidromeHost = safeUrlHostname(input.profile.navidromeUrl);
  const jellyfinHost = safeUrlHostname(input.profile.jellyfinUrl);

  const legacyPlatforms: PlatformConnection[] = [
    {
      id: "github",
      label: "GitHub",
      connected: Boolean(githubUsername),
      displayValue: githubUsername ? `@${githubUsername}` : undefined,
      authorizeUrl: "/connect/github",
    },
    {
      id: "listenbrainz",
      label: "ListenBrainz",
      connected: listenbrainzConnected,
      displayValue: input.profile.listenbrainzUsername
        ? `@${input.profile.listenbrainzUsername}`
        : undefined,
      authorizeUrl: "/connect/listenbrainz",
    },
    {
      id: "jellyfin",
      label: "Jellyfin",
      connected: jellyfinConnected,
      displayValue:
        jellyfinHost ??
        (input.profile.jellyfinUsername ? `@${input.profile.jellyfinUsername}` : undefined),
      authorizeUrl: "/connect/jellyfin",
    },
    {
      id: "navidrome",
      label: "Navidrome",
      connected: navidromeConnected,
      displayValue: navidromeHost,
    },
    {
      id: "musicbrainz",
      label: "MusicBrainz",
      connected: mbLink.connected,
      displayValue: "displayValue" in mbLink ? mbLink.displayValue : undefined,
      authorizeUrl: "/communities/navidrome",
    },
    {
      id: "gmail",
      label: "Gmail",
      connected: Boolean(input.profile.gmailConnected),
      displayValue: input.profile.gmailConnected ? "Inbox connected" : undefined,
      authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
    },
    {
      id: "wallet",
      label: "Arc wallet",
      connected: Boolean(appWallet || externalWallet),
      displayValue:
        appWallet && externalWallet
          ? `RESOLVE ${appWallet.slice(0, 6)}…${appWallet.slice(-4)} · yours ${externalWallet.slice(0, 6)}…${externalWallet.slice(-4)}`
          : appWallet
            ? `RESOLVE ${appWallet.slice(0, 6)}…${appWallet.slice(-4)}`
            : externalWallet
              ? `Yours ${externalWallet.slice(0, 6)}…${externalWallet.slice(-4)}`
              : undefined,
    },
    {
      id: "payout",
      label: "Payout destination",
      connected: Boolean(payoutDestination),
      displayValue: payoutDestination
        ? `${payoutDestination.address.slice(0, 6)}...${payoutDestination.address.slice(-4)}`
        : undefined,
      lastSyncAt: payoutDestination?.updatedAt.toISOString() ?? null,
      syncStatus: payoutDestination
        ? payoutDestination.status === "verified"
          ? "connected"
          : payoutDestination.status === "pending"
            ? "syncing"
            : "reconnect_required"
        : "not_connected",
    },
  ];

  const platforms = legacyPlatforms.map((legacy): PlatformConnection => {
    const persisted = sourceByProvider.get(legacy.id);
    if (!persisted) return legacy;
    const expired = Boolean(persisted.authExpiresAt && persisted.authExpiresAt.getTime() <= Date.now());
    const syncStatus = expired ? "reconnect_required" : persistedStatus(persisted.status);
    const connected = ["connected", "syncing", "stale"].includes(syncStatus);
    return {
      ...legacy,
      connected,
      displayValue: persisted.displayLabel ?? legacy.displayValue,
      providerUserId: persisted.externalAccountId ?? legacy.providerUserId,
      username: persisted.externalAccountId ?? legacy.username,
      lastSyncAt: persisted.lastSyncedAt?.toISOString() ?? null,
      syncStatus,
      error: ["failed", "error", "reconnect_required"].includes(syncStatus)
        ? `Source state: ${syncStatus}`
        : null,
    };
  });

  const hasAnyConnector = platforms.some(
    (p) => p.connected && p.id !== "wallet" && p.id !== "payout" && p.id !== "gmail",
  );

  const sourceUpdatedAt = sourceRows.reduce(
    (latest, row) => Math.max(latest, row.updatedAt.getTime()),
    Math.max(input.profile.updatedAt.getTime(), payoutDestination?.updatedAt.getTime() ?? 0),
  );

  return {
    signedIn: true,
    userId: input.userId,
    updatedAt: new Date(sourceUpdatedAt).toISOString(),
    lastSyncedAt: platforms.reduce<string | null>((latest, row) => {
      if (!row.lastSyncAt) return latest;
      return !latest || row.lastSyncAt > latest ? row.lastSyncAt : latest;
    }, input.profile.updatedAt.toISOString()),
    platforms,
    installedCommunitySlugs,
    hasAnyConnector,
    githubUsername,
  };
}
