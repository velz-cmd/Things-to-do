import { NextResponse } from "next/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { syncUserMusicSensors } from "@/lib/connectors/user-music-sync";
import { syncUserJellyfinSensors } from "@/lib/connectors/user-jellyfin-sync";
import { syncUserGithubSensors, syncUserOpenAlexSensors } from "@/lib/connectors/user-github-sync";
import { getUserConnectionState } from "@/lib/profile/connection-state";
import { emptyConnectionState, type UserConnectionState } from "@/lib/profile/connection-state-types";
import { invalidateConnectorCaches } from "@/lib/profile/invalidate-connector-cache";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";

export const dynamic = "force-dynamic";

async function buildState(authUser: SupabaseUser): Promise<UserConnectionState> {
  let profile = await ensureProfileForUser(authUser);
  profile = await sanitizeConnectorIdentities(authUser.id, profile);
  return getUserConnectionState({ userId: authUser.id, profile, walletAddress: resolveUserWallet(authUser.id, profile).address });
}

export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) return NextResponse.json({ ok: true, ...emptyConnectionState() });
  try {
    return NextResponse.json({ ok: true, ...(await buildState(authUser)) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[profile/connections GET]", error);
    return NextResponse.json({ ok: false, ...emptyConnectionState(), error: "load_failed" });
  }
}

const syncSchema = z.object({ provider: z.enum(["github", "listenbrainz", "navidrome", "jellyfin", "openalex", "gmail"]) });
type SyncProvider = z.infer<typeof syncSchema>["provider"];

async function syncOneProvider(userId: string, provider: SyncProvider) {
  if (provider === "github") return syncUserGithubSensors(userId);
  if (provider === "listenbrainz" || provider === "navidrome") return syncUserMusicSensors(userId);
  if (provider === "jellyfin") return syncUserJellyfinSensors(userId);
  if (provider === "openalex") return syncUserOpenAlexSensors(userId);
  return { ok: true as const, ingested: 0, persistedOnly: true };
}

/** User-requested, provider-scoped refresh. It never starts an all-provider stampede. */
export async function POST(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  const parsed = syncSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "valid_provider_required" }, { status: 400 });
  const provider = parsed.data.provider;
  const idempotencyKey = req.headers.get("idempotency-key") ?? `profile.sync_source:${authUser.id}:${provider}:${Math.floor(Date.now() / 30_000)}`;

  try {
    const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey } });
    if (existing?.state === "completed") return NextResponse.json({ ok: true, replayed: true, actionRunId: existing.id, provider });
    const run = existing ?? await prisma.actionRun.create({ data: { userId: authUser.id, actionId: "profile.sync_source", aggregateType: "SourceConnection", aggregateId: provider, idempotencyKey, state: "pending_external", recommendationReason: "The user requested a provider-scoped refresh from the visible source detail.", input: { provider } } });
    let profile = await ensureProfileForUser(authUser);
    profile = await sanitizeConnectorIdentities(authUser.id, profile);
    const sync = await syncOneProvider(authUser.id, provider).catch((error) => ({ ok: false as const, ingested: 0, error: error instanceof Error ? error.message : "sync_failed" }));
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.sourceConnection.updateMany({ where: { userId: authUser.id, provider }, data: { lastSyncedAt: now, status: sync.ok ? "connected" : "error" } });
      await tx.actionRun.update({ where: { id: run.id }, data: { state: sync.ok ? "completed" : "sync_failed", output: { provider, ingested: sync.ingested ?? 0 }, errorCode: sync.ok ? null : "PROVIDER_SYNC_FAILED", errorMessage: "error" in sync ? sync.error : null, completedAt: now } });
      await appendOperationalEventInTransaction(tx, { eventType: sync.ok ? "profile.source_synchronized" : "profile.source_sync_failed", aggregateType: "SourceConnection", aggregateId: provider, userId: authUser.id, correlationId: req.headers.get("x-correlation-id") ?? idempotencyKey, idempotencyKey: `${idempotencyKey}:event`, payload: { provider, ingested: sync.ingested ?? 0 } });
    });
    await invalidateConnectorCaches(authUser.id);
    const state = await getUserConnectionState({ userId: authUser.id, profile: { ...profile, updatedAt: now }, walletAddress: resolveUserWallet(authUser.id, profile).address });
    return NextResponse.json({ ok: sync.ok, ...state, actionRunId: run.id, provider, lastSyncedAt: now.toISOString(), sync }, { status: sync.ok ? 200 : 502 });
  } catch (error) {
    console.error("[profile/connections POST]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "refresh_failed" }, { status: 500 });
  }
}
