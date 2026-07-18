import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { buildFastIdentities } from "@/lib/profile/build-fast-identities";
import { loadProfileFast } from "@/lib/profile/load-profile-fast";
import { resolveCanonicalWalletRegistry } from "@/lib/wallet/canonical-wallet-registry";
import { profileAuthorizeUrl } from "@/lib/profile/oauth-return";

export type ProfileBlocker = {
  id: "identity" | "source" | "payout" | "security";
  label: string;
  destination: "identities" | "sources" | "wallets" | "security";
};

export type ProfileIdentitySummary = {
  id: string;
  provider: string;
  label: string;
  value: string | null;
  status: "verified" | "connected" | "candidate" | "conflicted" | "expired" | "not_connected";
  purpose: string;
  verifiedAt: string | null;
  authorizeUrl: string | null;
};

export type ProfileConnectionSummary = {
  id: string;
  provider: string;
  label: string;
  group: "work" | "music_media" | "research" | "community" | "account";
  account: string | null;
  status: "connected" | "expired" | "error" | "not_connected";
  health: "healthy" | "attention" | "unknown";
  lastSyncAt: string | null;
  permissions: string[];
  purpose: string;
  authorizeUrl: string | null;
};

export type ProfileWalletSummary = {
  id: string;
  address: `0x${string}`;
  network: string;
  provider: string;
  status: string;
  verificationState?: "unverified" | "pending" | "verified";
};

export type ProfileBootstrap = {
  ok: true;
  signedIn: true;
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    handle: string | null;
  };
  readiness: {
    identityReady: boolean;
    sourceReady: boolean;
    payoutReady: boolean;
    securityReady: boolean;
    blockers: ProfileBlocker[];
  };
  identities: ProfileIdentitySummary[];
  connections: ProfileConnectionSummary[];
  wallets: {
    appWallet: ProfileWalletSummary | null;
    connectedWallet: ProfileWalletSummary | null;
    payoutDestination: ProfileWalletSummary | null;
  };
  roles: string[];
  claims: Array<{
    id: string;
    provider: string;
    label: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
  }>;
  relationships: {
    communities: Array<{ id: string; slug: string; status: string; installedAt: string }>;
    programs: Array<{ id: string; name: string; status: string; communitySlug: string }>;
    fundedProgramCount: number;
  };
  economics: {
    earnedUsd: number;
    claimableUsd: number;
    authorizedUsd: number;
    settledUsd: number;
    pendingUsd: number;
    ledgerEntryCount: number;
    latestSettlement: { id: string; status: string; amountUsd: number; updatedAt: string } | null;
    latestReceipt: { reference: string; amountUsd: number; issuedAt: string } | null;
  };
  security: {
    activeSessions: number;
    lastSignInAt: string | null;
    twoFactorConfigured: boolean | null;
    authenticationMethod: string;
  };
  activity: Array<{
    id: string;
    eventType: string;
    label: string;
    occurredAt: string;
  }>;
  freshness: {
    generatedAt: string;
    connectionState: "live" | "recent" | "stale";
    version: string;
  };
  // Compatibility fields for existing shared consumers during the route migration.
  userId: string;
  email: string | null;
  emailVerified: boolean;
  wallet: { address: string; embedded: boolean; provider: string } | null;
};

const PROVIDERS: Record<string, { label: string; group: ProfileConnectionSummary["group"]; purpose: string; authorizeUrl: string | null }> = {
  github: { label: "GitHub", group: "work", purpose: "Code and documentation attribution", authorizeUrl: "/connect/github?returnTo=/profile?view=sources" },
  listenbrainz: { label: "ListenBrainz", group: "music_media", purpose: "Verified listening activity", authorizeUrl: "/connect/listenbrainz?returnTo=/profile?view=sources" },
  musicbrainz: { label: "MusicBrainz", group: "music_media", purpose: "Artist and release identity", authorizeUrl: null },
  navidrome: { label: "Navidrome", group: "music_media", purpose: "Self-hosted music activity", authorizeUrl: null },
  jellyfin: { label: "Jellyfin", group: "music_media", purpose: "Media-session evidence", authorizeUrl: "/connect/jellyfin?returnTo=/profile?view=sources" },
  gmail: { label: "Gmail", group: "account", purpose: "Receipt-backed evidence", authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile?view=sources" },
};

function jsonStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((row): row is string => typeof row === "string");
  if (value && typeof value === "object") {
    const scopes = (value as { scopes?: unknown }).scopes;
    if (Array.isArray(scopes)) return scopes.filter((row): row is string => typeof row === "string");
  }
  return [];
}

function eventLabel(eventType: string): string {
  return eventType.replaceAll(".", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function identityPurpose(provider: string): string {
  return PROVIDERS[provider]?.purpose ?? "Verified work attribution";
}

export async function loadProfileControlPlaneBootstrap(authUser: SupabaseUser): Promise<ProfileBootstrap> {
  const profile = await loadProfileFast(authUser);
  const [
    sourceRows,
    identityRows,
    payout,
    walletRows,
    events,
    claimRows,
    installs,
    programs,
    fundedProgramCount,
    earnings,
    ledgerEntryCount,
    latestSettlement,
  ] = await Promise.all([
    prisma.sourceConnection.findMany({ where: { userId: authUser.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.identity.findMany({ where: { userId: authUser.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.payoutDestination.findFirst({ where: { userId: authUser.id }, orderBy: [{ verifiedAt: "desc" }, { updatedAt: "desc" }] }),
    prisma.wallet.findMany({ where: { userId: authUser.id, status: "active" }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.operationalEvent.findMany({ where: { userId: authUser.id, OR: [
      { aggregateType: { in: ["Identity", "SourceConnection", "PayoutDestination", "Wallet", "User"] } },
      { eventType: { startsWith: "profile." } },
      { eventType: { startsWith: "source." } },
      { eventType: { startsWith: "identity." } },
    ] }, orderBy: { occurredAt: "desc" }, take: 12 }),
    prisma.identityClaim.findMany({
      where: { userId: authUser.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.resolveCommunityInstall.findMany({
      where: { userId: authUser.id },
      select: { id: true, communitySlug: true, status: true, installedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.resolveProgram.findMany({
      where: { userId: authUser.id },
      select: {
        id: true,
        name: true,
        status: true,
        install: { select: { communitySlug: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.communityFundStake.count({ where: { userId: authUser.id } }),
    prisma.userEarningsSnapshot.findUnique({ where: { userId: authUser.id } }),
    prisma.earningsLedgerEntry.count({ where: { userId: authUser.id } }),
    prisma.settlementBatch.findFirst({
      where: { userId: authUser.id },
      select: { id: true, status: true, totalUsdcMicro: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const [claimIdentities, latestReceipt] = await Promise.all([
    claimRows.length
      ? prisma.observedIdentity.findMany({
          where: { id: { in: claimRows.map((claim) => claim.observedIdentityId) } },
          select: { id: true, provider: true, displayLabel: true, externalRef: true },
        })
      : [],
    latestSettlement
      ? prisma.receipt.findUnique({
          where: { settlementBatchId: latestSettlement.id },
          select: { publicReference: true, totalUsdcMicro: true, issuedAt: true },
        })
      : null,
  ]);

  const fastIdentities = buildFastIdentities(profile).filter((row) => row.id !== "wallet");
  const sourceByProvider = new Map(sourceRows.map((row) => [row.provider.toLowerCase(), row]));
  const identityProviders = new Set<string>();
  const identities: ProfileIdentitySummary[] = identityRows.map((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    const provider = typeof metadata.provider === "string" ? metadata.provider.toLowerCase() : row.canonicalRef.split(":")[0]!.toLowerCase();
    identityProviders.add(provider);
    const status = row.status === "verified" ? "verified" : row.status === "conflicted" ? "conflicted" : row.status === "candidate" ? "candidate" : "connected";
    return { id: row.id, provider, label: PROVIDERS[provider]?.label ?? provider, value: row.displayName ?? row.canonicalRef, status, purpose: identityPurpose(provider), verifiedAt: row.verifiedAt?.toISOString() ?? null, authorizeUrl: PROVIDERS[provider]?.authorizeUrl ?? null };
  });
  for (const row of fastIdentities) {
    if (identityProviders.has(row.id)) continue;
    identities.push({ id: `profile:${row.id}`, provider: row.id, label: PROVIDERS[row.id]?.label ?? row.id, value: row.displayValue ?? null, status: row.connected ? "connected" : "not_connected", purpose: identityPurpose(row.id), verifiedAt: null, authorizeUrl: row.authorizeUrl ? profileAuthorizeUrl(row.authorizeUrl, "/profile?view=identities") : PROVIDERS[row.id]?.authorizeUrl ?? null });
  }

  const connectionProviders = new Set([...Object.keys(PROVIDERS), ...sourceRows.map((row) => row.provider.toLowerCase()), ...fastIdentities.map((row) => row.id)]);
  const connections: ProfileConnectionSummary[] = [...connectionProviders].filter((provider) => provider !== "wallet" && provider !== "musicbrainz").map((provider) => {
    const persisted = sourceByProvider.get(provider);
    const legacy = fastIdentities.find((row) => row.id === provider);
    const definition = PROVIDERS[provider] ?? { label: provider, group: "community" as const, purpose: "Connected evidence source", authorizeUrl: null };
    const expired = Boolean(persisted?.authExpiresAt && persisted.authExpiresAt.getTime() <= Date.now());
    const connected = persisted?.status === "connected" || Boolean(legacy?.connected);
    const status: ProfileConnectionSummary["status"] = expired ? "expired" : persisted?.status === "error" ? "error" : connected ? "connected" : "not_connected";
    return { id: persisted?.id ?? `profile:${provider}`, provider, label: definition.label, group: definition.group, account: persisted?.displayLabel ?? legacy?.displayValue ?? null, status, health: status === "connected" ? "healthy" : status === "not_connected" ? "unknown" : "attention", lastSyncAt: persisted?.lastSyncedAt?.toISOString() ?? null, permissions: jsonStrings(persisted?.capabilitiesJson), purpose: definition.purpose, authorizeUrl: legacy?.authorizeUrl ? profileAuthorizeUrl(legacy.authorizeUrl, "/profile?view=sources") : definition.authorizeUrl };
  });

  const appWalletRecord = walletRows.find((row) => row.address.toLowerCase() === profile.walletAddress?.toLowerCase()) ?? walletRows.find((row) => row.custodyType !== "external");
  const registry = resolveCanonicalWalletRegistry({ userId: authUser.id, profile, appWalletId: appWalletRecord?.id, appWalletProvider: appWalletRecord?.provider === "circle" ? "circle" : "embedded", payoutDestination: payout ? { address: payout.address, status: payout.status } : null });
  const appWallet = registry.appWallet ? { id: registry.appWallet.walletId, address: registry.appWallet.address, network: "Arc Testnet", provider: registry.appWallet.provider, status: "active" } satisfies ProfileWalletSummary : null;
  const connectedWallet = registry.connectedWallet ? { id: `connected:${registry.connectedWallet.address}`, address: registry.connectedWallet.address, network: "Arc Testnet", provider: registry.connectedWallet.connector, status: "connected" } satisfies ProfileWalletSummary : null;
  const payoutDestination = registry.payoutWallet ? { id: payout?.id ?? `payout:${registry.payoutWallet.address}`, address: registry.payoutWallet.address, network: payout?.network ?? "Arc Testnet", provider: "payout", status: payout?.status ?? registry.payoutWallet.verificationState, verificationState: registry.payoutWallet.verificationState } satisfies ProfileWalletSummary : null;

  const identityReady = identities.some((row) => row.provider !== "gmail" && (row.status === "verified" || row.status === "connected"));
  const sourceReady = connections.some((row) => row.status === "connected");
  const payoutReady = payoutDestination?.verificationState === "verified";
  const emailVerified = Boolean(authUser.email_confirmed_at);
  const securityReady = emailVerified;
  const blockers: ProfileBlocker[] = [];
  if (!identityReady) blockers.push({ id: "identity", label: "Connect or verify an identity used for attribution.", destination: "identities" });
  if (!sourceReady) blockers.push({ id: "source", label: "Connect an evidence source for supported work.", destination: "sources" });
  if (!payoutReady) blockers.push({ id: "payout", label: "Confirm a payout destination before settlement.", destination: "wallets" });
  if (!securityReady) blockers.push({ id: "security", label: "Verify the account email used for recovery.", destination: "security" });

  const newestConnectionAt = connections.flatMap((row) => row.lastSyncAt ? [new Date(row.lastSyncAt).getTime()] : []);
  const newest = newestConnectionAt.length ? Math.max(...newestConnectionAt) : profile.updatedAt.getTime();
  const age = Date.now() - newest;
  const connectionState = age < 5 * 60_000 ? "live" : age < 24 * 60 * 60_000 ? "recent" : "stale";
  const handle = profile.githubUsername ?? (typeof authUser.user_metadata?.user_name === "string" ? authUser.user_metadata.user_name : null);
  const avatarUrl = typeof authUser.user_metadata?.avatar_url === "string" ? authUser.user_metadata.avatar_url : null;
  const claimIdentityById = new Map(claimIdentities.map((identity) => [identity.id, identity]));
  const roles = new Set<string>();
  if (connections.some((row) => row.provider === "github" && row.status === "connected")) roles.add("Developer");
  if (connections.some((row) => ["listenbrainz", "navidrome", "jellyfin", "peertube"].includes(row.provider) && row.status === "connected")) roles.add("Creator");
  if (identityRows.some((row) => row.status === "verified") || ledgerEntryCount > 0) roles.add("Contributor");
  if (installs.length > 0) roles.add("Community operator");
  if (programs.length > 0) roles.add("Program operator");
  if (fundedProgramCount > 0) roles.add("Funder");

  const microToUsd = (value: bigint) => Number(value) / 1_000_000;

  return {
    ok: true,
    signedIn: true,
    user: { id: authUser.id, email: authUser.email ?? profile.email, emailVerified, displayName: profile.displayName ?? authUser.user_metadata?.full_name ?? null, avatarUrl, handle },
    readiness: { identityReady, sourceReady, payoutReady, securityReady, blockers },
    identities,
    connections,
    wallets: { appWallet, connectedWallet, payoutDestination },
    roles: [...roles],
    claims: claimRows.map((claim) => {
      const identity = claimIdentityById.get(claim.observedIdentityId);
      return {
        id: claim.id,
        provider: identity?.provider ?? "unknown",
        label: identity?.displayLabel ?? identity?.externalRef ?? "Observed identity",
        status: claim.status,
        createdAt: claim.createdAt.toISOString(),
        reviewedAt: claim.reviewedAt?.toISOString() ?? null,
      };
    }),
    relationships: {
      communities: installs.map((install) => ({
        id: install.id,
        slug: install.communitySlug,
        status: install.status,
        installedAt: install.installedAt.toISOString(),
      })),
      programs: programs.map((program) => ({
        id: program.id,
        name: program.name,
        status: program.status,
        communitySlug: program.install.communitySlug,
      })),
      fundedProgramCount,
    },
    economics: {
      earnedUsd: earnings?.youEarnedUsd ?? 0,
      claimableUsd: earnings?.claimableUsd ?? 0,
      authorizedUsd: earnings?.authorizedUsd ?? 0,
      settledUsd: earnings?.settledUsd ?? 0,
      pendingUsd: earnings?.pendingUsd ?? 0,
      ledgerEntryCount,
      latestSettlement: latestSettlement
        ? {
            id: latestSettlement.id,
            status: latestSettlement.status,
            amountUsd: microToUsd(latestSettlement.totalUsdcMicro),
            updatedAt: latestSettlement.updatedAt.toISOString(),
          }
        : null,
      latestReceipt: latestReceipt
        ? {
            reference: latestReceipt.publicReference,
            amountUsd: microToUsd(latestReceipt.totalUsdcMicro),
            issuedAt: latestReceipt.issuedAt.toISOString(),
          }
        : null,
    },
    security: { activeSessions: 1, lastSignInAt: authUser.last_sign_in_at ?? null, twoFactorConfigured: null, authenticationMethod: profile.authProvider },
    activity: events.map((row) => ({ id: row.id, eventType: row.eventType, label: eventLabel(row.eventType), occurredAt: row.occurredAt.toISOString() })),
    freshness: { generatedAt: new Date().toISOString(), connectionState, version: profile.updatedAt.toISOString() },
    userId: authUser.id,
    email: authUser.email ?? profile.email,
    emailVerified,
    wallet: appWallet ? { address: appWallet.address, embedded: profile.embeddedWallet, provider: appWallet.provider } : null,
  };
}
