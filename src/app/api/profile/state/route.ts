import { NextResponse } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth/session";
import { getUserConnectionState } from "@/lib/profile/connection-state";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";
import { resolveOnChainReadAddress, resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import { loadProfileFast } from "@/lib/profile/load-profile-fast";
import { cacheGetOrSet } from "@/lib/cache/kv";
import type { ConnectionSyncStatus } from "@/lib/profile/connection-state-types";

export const dynamic = "force-dynamic";

type ConnectorState = {
  provider: string;
  connected: boolean;
  account: string | null;
  providerUserId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncAt: string | null;
  status: ConnectionSyncStatus;
  syncStatus: ConnectionSyncStatus;
  error: string | null;
  scopes: string[];
};

function normalizeHandle(value: string | null | undefined) {
  return value?.trim().replace(/^@/, "") || null;
}

function connectorState(input: {
  provider: string;
  connected: boolean;
  account?: string | null;
  providerUserId?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  lastSyncAt?: string | null;
  scopes?: string[];
  status?: ConnectionSyncStatus;
  error?: string | null;
}): ConnectorState {
  const account = input.account ?? input.providerUserId ?? null;
  const status = input.status ?? (input.connected ? "connected" : "not_connected");
  return {
    provider: input.provider,
    connected: input.connected,
    account,
    providerUserId: input.providerUserId ?? normalizeHandle(account),
    username: input.username ?? normalizeHandle(account),
    displayName: input.displayName ?? account,
    avatarUrl: input.avatarUrl ?? null,
    lastSyncAt: input.lastSyncAt ?? null,
    status,
    syncStatus: status,
    error: input.error ?? null,
    scopes: input.scopes ?? [],
  };
}

async function buildProfileState(authUser: SupabaseUser, fast = false) {
  const profile = await loadProfileFast(authUser);

  const wallet = resolveUserWallet(authUser.id, profile);
  const balanceWallet = resolveOnChainReadAddress(authUser.id, profile);
  const connectionState = await getUserConnectionState({
    userId: authUser.id,
    profile,
    walletAddress: balanceWallet,
    fast,
  });

  const connectors = connectionState.platforms.reduce<Record<string, ConnectorState>>(
    (acc, platform) => {
      acc[platform.id] = connectorState({
        provider: platform.id,
        connected: platform.connected,
        account: platform.displayValue ?? null,
        providerUserId: platform.providerUserId ?? normalizeHandle(platform.displayValue),
        username: platform.username ?? normalizeHandle(platform.displayValue),
        displayName: platform.displayName ?? platform.displayValue ?? null,
        avatarUrl: platform.avatarUrl ?? null,
        lastSyncAt: connectionState.lastSyncedAt,
        status: platform.syncStatus ?? (platform.connected ? "connected" : "not_connected"),
        error: platform.error ?? null,
        scopes: platform.scopes ?? [],
      });
      return acc;
    },
    {},
  );

  const walletConnector = connectorState({
    provider: "arcWallet",
    connected: Boolean(wallet.address),
    account: wallet.address,
    providerUserId: wallet.address,
    lastSyncAt: connectionState.lastSyncedAt,
    status: wallet.address ? "connected" : "not_connected",
    scopes: ["fund", "claim", "settle"],
  });
  connectors.arcWallet = walletConnector;
  connectors.wallet = { ...walletConnector, provider: "wallet" };

  return {
    ...connectionState,
    ok: true,
    signedIn: true,
    user: {
      id: authUser.id,
      email: authUser.email ?? profile.email ?? null,
      displayName:
        profile.displayName ??
        (authUser.user_metadata?.full_name as string | undefined) ??
        authUser.email?.split("@")[0] ??
        null,
      avatarUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    email: authUser.email ?? profile.email ?? null,
    connectors,
  };
}

export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    const empty = emptyConnectionState();
    return NextResponse.json({
      ok: true,
      user: null,
      email: null,
      connectors: {},
      ...empty,
      signedIn: false,
    });
  }

  try {
    const fast = new URL(req.url).searchParams.get("fast") === "1";
    const cacheKey = fast ? `profile:state:fast:${authUser.id}` : `profile:state:${authUser.id}`;
    const ttl = fast ? 30 : 45;
    const state = await cacheGetOrSet(cacheKey, ttl, () => buildProfileState(authUser, fast));
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": fast ? "private, max-age=10, stale-while-revalidate=60" : "no-store, max-age=0",
      },
    });
  } catch (e) {
    console.error("[profile/state]", e);
    const empty = emptyConnectionState();
    return NextResponse.json({
      ok: false,
      user: { id: authUser.id, email: authUser.email ?? null },
      email: authUser.email ?? null,
      connectors: {},
      ...empty,
      signedIn: true,
      userId: authUser.id,
      error: "profile_state_syncing",
    });
  }
}
