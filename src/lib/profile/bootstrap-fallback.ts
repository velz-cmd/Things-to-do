import type { User as SupabaseUser } from "@supabase/supabase-js";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import type { ProfileIdentityState } from "@/app/api/profile/identities/route";

/** Profile payload when Postgres is unavailable — no DB required. */
export function offlineProfileBootstrap(authUser: SupabaseUser) {
  const walletAddress = embeddedWalletFor(authUser.id).toLowerCase();

  const identities: ProfileIdentityState[] = [
    {
      id: "github",
      connected: false,
      hint: "Connect GitHub to claim code contributions",
      authorizeUrl: "/connect/github",
    },
    {
      id: "wallet",
      connected: true,
      displayValue: `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
      hint: "Your RESOLVE wallet on Arc — unique to your account",
      health: "healthy",
    },
    {
      id: "navidrome",
      connected: false,
      hint: "Optional — ListenBrainz covers most listeners",
    },
    {
      id: "jellyfin",
      connected: false,
      hint: "Connect Jellyfin — one click",
      authorizeUrl: "/connect/jellyfin",
    },
    {
      id: "listenbrainz",
      connected: false,
      hint: "Connect MusicBrainz — one click",
      authorizeUrl: "/connect/listenbrainz",
    },
    {
      id: "gmail",
      connected: false,
      hint: "Optional — receipt-based claims",
      authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
    },
  ];

  return {
    ok: true as const,
    signedIn: true as const,
    email: authUser.email ?? null,
    emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
    identities,
    earnings: {
      signedIn: true,
      youEarnedUsd: 0,
      claimableUsd: 0,
      authorizedUsd: 0,
      settledUsd: 0,
      stalestClaimableAt: null,
      notifyUrgency: 0,
      githubLinked: false,
      identities: [],
    },
    communities: [] as Array<{ slug: string; name: string; installed: boolean }>,
    wallet: {
      address: walletAddress,
      embedded: true,
      provider: "embedded" as const,
    },
    dbDegraded: true,
    updatedAt: new Date().toISOString(),
  };
}
