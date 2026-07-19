import type { User as SupabaseUser } from "@supabase/supabase-js";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import type { ProfileBootstrap } from "@/lib/profile/control-plane-bootstrap";

/**
 * Honest, auth-backed Profile payload when Postgres is unavailable.
 * Connected sources, claims, balances, and receipts are never inferred.
 */
export function offlineProfileBootstrap(
  authUser: SupabaseUser,
  degradedSections: string[] = ["profile_database"],
): ProfileBootstrap {
  const walletAddress = embeddedWalletFor(authUser.id).toLowerCase();
  const generatedAt = new Date().toISOString();
  const emailVerified = Boolean(authUser.email_confirmed_at);
  const displayName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    authUser.email?.split("@")[0] ??
    null;
  const providers = [
    ["github", "GitHub", "work", "Code and documentation attribution", "/connect/github?returnTo=/profile?view=sources"],
    ["listenbrainz", "ListenBrainz", "music_media", "Verified listening activity", "/connect/listenbrainz?returnTo=/profile?view=sources"],
    ["musicbrainz", "MusicBrainz", "music_media", "Artist and release identity", null],
    ["navidrome", "Navidrome", "music_media", "Self-hosted music activity", null],
    ["jellyfin", "Jellyfin", "music_media", "Media-session evidence", "/connect/jellyfin?returnTo=/profile?view=sources"],
    ["gmail", "Gmail", "account", "Receipt-backed evidence", "/api/connectors/gmail/authorize?returnTo=/profile?view=sources"],
  ] as const;

  return {
    ok: true,
    signedIn: true,
    degraded: true,
    degradedSections,
    user: {
      id: authUser.id,
      email: authUser.email ?? null,
      emailVerified,
      displayName,
      avatarUrl: typeof authUser.user_metadata?.avatar_url === "string" ? authUser.user_metadata.avatar_url : null,
      handle: null,
    },
    readiness: {
      identityReady: false,
      sourceReady: false,
      payoutReady: false,
      securityReady: emailVerified,
      blockers: [
        { id: "identity", label: "Identity records are temporarily unavailable.", destination: "identities" },
        { id: "source", label: "Connection records are temporarily unavailable.", destination: "sources" },
        { id: "payout", label: "Payout records are temporarily unavailable.", destination: "wallets" },
      ],
    },
    identities: [],
    connections: providers.map(([provider, label, group, purpose, authorizeUrl]) => ({
      id: `degraded:${provider}`,
      provider,
      label,
      group,
      account: null,
      status: "not_connected" as const,
      health: "unknown" as const,
      lastSyncAt: null,
      permissions: [],
      purpose,
      authorizeUrl,
    })),
    wallets: {
      appWallet: {
        id: `embedded:${authUser.id}`,
        address: walletAddress as `0x${string}`,
        network: "Arc Testnet",
        provider: "embedded",
        status: "derived",
      },
      connectedWallet: null,
      payoutDestination: null,
    },
    roles: [],
    claims: [],
    relationships: { communities: [], programs: [], fundedProgramCount: 0 },
    economics: {
      earnedUsd: 0,
      claimableUsd: 0,
      authorizedUsd: 0,
      settledUsd: 0,
      pendingUsd: 0,
      ledgerEntryCount: 0,
      latestSettlement: null,
      latestReceipt: null,
    },
    security: {
      activeSessions: 1,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      twoFactorConfigured: null,
      authenticationMethod: String(authUser.app_metadata?.provider ?? "unknown"),
    },
    activity: [],
    freshness: { generatedAt, connectionState: "stale", version: generatedAt },
    userId: authUser.id,
    email: authUser.email ?? null,
    emailVerified,
    wallet: { address: walletAddress, embedded: true, provider: "embedded" },
  };
}
