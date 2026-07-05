import { NextResponse } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";
import { getUserConnectionState } from "@/lib/profile/connection-state";
import {
  emptyConnectionState,
  type UserConnectionState,
} from "@/lib/profile/connection-state-types";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import { refreshUserEarningsSnapshot } from "@/lib/earn/earnings-snapshot";

export const dynamic = "force-dynamic";

async function buildState(authUser: SupabaseUser): Promise<UserConnectionState> {
  let profile = await ensureProfileForUser(authUser);
  profile = await sanitizeConnectorIdentities(authUser.id, profile);

  const wallet = resolveUserWallet(authUser.id, profile);
  return getUserConnectionState({
    userId: authUser.id,
    profile,
    walletAddress: wallet.address,
  });
}

/** Cross-tab connection memory — identities, installed communities, sync timestamps. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: true, ...emptyConnectionState() });
  }

  try {
    const state = await buildState(authUser);
    return NextResponse.json(
      { ok: true, ...state },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    console.error("[profile/connections GET]", e);
    return NextResponse.json({ ok: false, ...emptyConnectionState(), error: "load_failed" });
  }
}

/** Manual refresh — re-sync sensors and refresh earnings snapshot. No re-connect prompts. */
export async function POST() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }

  try {
    let profile = await ensureProfileForUser(authUser);
    profile = await sanitizeConnectorIdentities(authUser.id, profile);

    await autoInstallCommunitiesForUser(authUser.id, profile).catch(() => undefined);
    const sync = await syncUserSensors(authUser.id).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "sync_failed",
    }));
    void refreshUserEarningsSnapshot(authUser.id, profile).catch(() => undefined);

    const state = await getUserConnectionState({
      userId: authUser.id,
      profile: { ...profile, updatedAt: new Date() },
      walletAddress: resolveUserWallet(authUser.id, profile).address,
    });

    return NextResponse.json({
      ok: true,
      ...state,
      lastSyncedAt: new Date().toISOString(),
      sync,
    });
  } catch (e) {
    console.error("[profile/connections POST]", e);
    const message = e instanceof Error ? e.message : "refresh_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
