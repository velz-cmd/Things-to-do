import type { User as SupabaseUser } from "@supabase/supabase-js";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import type { ProfileBootstrap } from "@/lib/profile/control-plane-bootstrap";
import type { WorkspaceReadiness } from "@/lib/workspace/readiness-contract";

/**
 * Honest, auth-backed Profile payload when Postgres is unavailable.
 * Connected sources, claims, balances, and receipts are never inferred.
 */
export function offlineProfileBootstrap(
  authUser: SupabaseUser,
  degradedSections: string[] = ["profile_database"],
  readiness?: WorkspaceReadiness | null,
): ProfileBootstrap {
  const walletAddress =
    readiness?.wallets.app.address ?? embeddedWalletFor(authUser.id).toLowerCase();
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
      handle: readiness?.github.personal.account?.replace(/^@/, "") ?? null,
    },
    readiness: {
      identityReady: Boolean(
        readiness &&
          ["connected", "syncing", "stale"].includes(readiness.identities.github.state),
      ),
      sourceReady: Boolean(
        readiness?.sources.some((source) =>
          ["connected", "syncing", "stale"].includes(source.state),
        ),
      ),
      payoutReady: readiness?.wallets.payout.state === "connected",
      securityReady: emailVerified,
      blockers: [
        ...(!readiness || !["connected", "syncing", "stale"].includes(readiness.identities.github.state)
          ? [{ id: "identity" as const, label: "Connect a personal identity used for attribution.", destination: "identities" as const }]
          : []),
        ...(!readiness?.sources.some((source) => ["connected", "syncing", "stale"].includes(source.state))
          ? [{ id: "source" as const, label: "Connect an evidence source for supported work.", destination: "sources" as const }]
          : []),
        ...(readiness?.wallets.payout.state !== "connected"
          ? [{ id: "payout" as const, label: "Confirm a payout destination before settlement.", destination: "wallets" as const }]
          : []),
      ],
    },
    identities: [],
    connections: providers.map(([provider, label, group, purpose, authorizeUrl]) => {
      const shared =
        provider === "github"
          ? readiness?.github.personal
          : readiness?.sources.find((source) => source.provider === provider);
      const connected = Boolean(
        shared && ["connected", "syncing", "stale"].includes(shared.state),
      );
      return {
        id: `degraded:${provider}`,
        provider,
        label,
        group,
        account: shared?.account ?? null,
        status: connected ? ("connected" as const) : ("not_connected" as const),
        health:
          shared?.state === "sync_failed" || shared?.state === "permission_missing"
            ? ("attention" as const)
            : connected
              ? ("healthy" as const)
              : ("unknown" as const),
        lastSyncAt: shared?.lastSuccessfulAt ?? null,
        permissions: [],
        purpose,
        authorizeUrl,
      };
    }),
    wallets: {
      appWallet: readiness?.wallets.app.address
        ? {
            id: `persisted:${authUser.id}`,
            address: readiness.wallets.app.address as `0x${string}`,
            network: "Arc Testnet",
            provider: "resolve",
            status: readiness.wallets.app.state,
          }
        : {
            id: `embedded:${authUser.id}`,
            address: walletAddress as `0x${string}`,
            network: "Arc Testnet",
            provider: "embedded",
            status: "derived",
          },
      connectedWallet: readiness?.wallets.connected.address
        ? {
            id: `connected:${readiness.wallets.connected.address}`,
            address: readiness.wallets.connected.address as `0x${string}`,
            network: "Arc Testnet",
            provider: "reown",
            status: readiness.wallets.connected.state,
          }
        : null,
      payoutDestination: readiness?.wallets.payout.address
        ? {
            id: `payout:${readiness.wallets.payout.address}`,
            address: readiness.wallets.payout.address as `0x${string}`,
            network: readiness.wallets.payout.network ?? "Arc Testnet",
            provider: "payout",
            status: readiness.wallets.payout.state,
            verificationState:
              readiness.wallets.payout.state === "connected" ? "verified" : "pending",
          }
        : null,
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
    freshness: {
      generatedAt,
      connectionState: "stale",
      version: readiness?.computedAt ?? generatedAt,
    },
    userId: authUser.id,
    email: authUser.email ?? null,
    emailVerified,
    wallet: { address: walletAddress, embedded: true, provider: "embedded" },
  };
}
