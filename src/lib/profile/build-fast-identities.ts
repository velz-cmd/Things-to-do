import type { User } from "@prisma/client";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import {
  userJellyfinConfigured,
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";
import { safeUrlHostname } from "@/lib/profile/safe-url";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import type { ProfileIdentityState } from "@/lib/profile/identity-types";

/** Build identity cards from the user row only — no live connector or Circle calls. */
export function buildFastIdentities(profile: User): ProfileIdentityState[] {
  const githubUsername = normalizeGithubLogin(profile.githubUsername);
  const listenbrainzConnected = userListenBrainzConfigured(profile);
  const navidromeConnected = userNavidromeConfigured(profile);
  const jellyfinConnected = userJellyfinConfigured(profile);
  const wallet = resolveUserWallet(profile.id, profile);
  const navidromeHost = safeUrlHostname(profile.navidromeUrl);
  const jellyfinHost = safeUrlHostname(profile.jellyfinUrl);

  return [
    {
      id: "github",
      connected: Boolean(githubUsername),
      displayValue: githubUsername ? `@${githubUsername}` : undefined,
      hint: githubUsername ? undefined : "Connect GitHub to claim code contributions",
      authorizeUrl: "/connect/github",
    },
    {
      id: "wallet",
      connected: true,
      displayValue: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`,
      hint: "Your RESOLVE wallet on Arc — unique to your account",
      health: "healthy",
    },
    {
      id: "navidrome",
      connected: navidromeConnected,
      displayValue: navidromeHost,
      hint: navidromeConnected ? undefined : "Optional — ListenBrainz covers most listeners",
    },
    {
      id: "jellyfin",
      connected: jellyfinConnected,
      displayValue:
        jellyfinHost ??
        (profile.jellyfinUsername ? `@${profile.jellyfinUsername}` : undefined),
      hint: jellyfinConnected ? undefined : "Connect Jellyfin — one click",
      authorizeUrl: "/connect/jellyfin",
    },
    {
      id: "listenbrainz",
      connected: listenbrainzConnected,
      displayValue:
        profile.listenbrainzUsername ? `@${profile.listenbrainzUsername}` : undefined,
      hint: listenbrainzConnected ? undefined : "Sign in with MusicBrainz — one click",
      authorizeUrl: "/connect/listenbrainz",
    },
    {
      id: "gmail",
      connected: Boolean(profile.gmailConnected),
      displayValue: profile.gmailConnected ? "Inbox connected" : undefined,
      hint: profile.gmailConnected ? undefined : "Optional — receipt-based claims",
      authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
    },
  ];
}
