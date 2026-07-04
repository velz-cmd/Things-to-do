import { NextResponse } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { getUserConnectionState } from "@/lib/profile/connection-state";
import { emptyConnectionState } from "@/lib/profile/connection-state-types";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import { cacheGetOrSet } from "@/lib/cache/kv";

export const dynamic = "force-dynamic";

type ConnectorState = {
  provider: string;
  connected: boolean;
  account: string | null;
  providerUserId: string | null;
  lastSyncAt: string | null;
  status: "connected" | "not_connected" | "error";
  error: string | null;
  scopes: string[];
};

async function buildProfileState(authUser: SupabaseUser) {
  let profile = await ensureProfileForUser(authUser);
  profile = await sanitizeConnectorIdentities(authUser.id, profile);
  void autoInstallCommunitiesForUser(authUser.id, profile).catch(() => undefined);

  const wallet = resolveUserWallet(authUser.id, profile);
  const connectionState = await getUserConnectionState({
    userId: authUser.id,
    profile,
    walletAddress: wallet.address,
  });

  const connectors = connectionState.platforms.reduce<Record<string, ConnectorState>>(
    (acc, platform) => {
      acc[platform.id] = {
        provider: platform.id,
        connected: platform.connected,
        account: platform.displayValue ?? null,
        providerUserId: platform.displayValue ?? null,
        lastSyncAt: connectionState.lastSyncedAt,
        status: platform.connected ? "connected" : "not_connected",
        error: null,
        scopes: [],
      };
      return acc;
    },
    {},
  );

  connectors.arcWallet = {
    provider: "arcWallet",
    connected: Boolean(wallet.address),
    account: wallet.address,
    providerUserId: wallet.address,
    lastSyncAt: connectionState.lastSyncedAt,
    status: wallet.address ? "connected" : "not_connected",
    error: null,
    scopes: ["fund", "claim", "settle"],
  };

  return {
    ...connectionState,
    ok: true,
    signedIn: true,
    user: {
      id: authUser.id,
      email: authUser.email ?? profile.email ?? null,
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
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    const key = `profile:state:${authUser.id}`;
    const state = refresh
      ? await buildProfileState(authUser)
      : await cacheGetOrSet(key, 45, () => buildProfileState(authUser));
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
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
      error: e instanceof Error ? e.message : "profile_state_failed",
    });
  }
}
