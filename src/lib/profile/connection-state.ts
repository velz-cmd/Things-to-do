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
  PlatformConnection,
  UserConnectionState,
} from "@/lib/profile/connection-state-types";

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
}): Promise<UserConnectionState> {
  const githubUsername = normalizeGithubLogin(input.profile.githubUsername);
  const listenbrainzConnected = userListenBrainzConfigured(input.profile);
  const navidromeConnected = userNavidromeConfigured(input.profile);
  const jellyfinConnected = userJellyfinConfigured(input.profile);
  const wallet =
    input.profile.scanWalletAddress?.trim().toLowerCase() ??
    input.walletAddress?.trim().toLowerCase() ??
    input.profile.walletAddress?.trim().toLowerCase() ??
    null;

  const [installs, mbLink] = await Promise.all([
    prisma.resolveCommunityInstall
      .findMany({
        where: { userId: input.userId },
        select: { communitySlug: true },
      })
      .catch(() => []),
    musicbrainzLinked(wallet),
  ]);

  const installedCommunitySlugs = installs.map((i) => i.communitySlug);
  const navidromeHost = safeUrlHostname(input.profile.navidromeUrl);
  const jellyfinHost = safeUrlHostname(input.profile.jellyfinUrl);

  const platforms: PlatformConnection[] = [
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
      displayValue: mbLink.displayValue,
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
      connected: Boolean(wallet),
      displayValue: wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : undefined,
    },
  ];

  const hasAnyConnector = platforms.some(
    (p) => p.connected && p.id !== "wallet" && p.id !== "gmail",
  );

  return {
    signedIn: true,
    userId: input.userId,
    updatedAt: input.profile.updatedAt.toISOString(),
    lastSyncedAt: input.profile.updatedAt.toISOString(),
    platforms,
    installedCommunitySlugs,
    hasAnyConnector,
    githubUsername,
  };
}
