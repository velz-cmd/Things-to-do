import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listEcosystems } from "@/lib/mission/server/ecosystems";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import { loadProfileFast } from "@/lib/profile/load-profile-fast";
import { buildFastIdentities } from "@/lib/profile/build-fast-identities";
import type { ProfileIdentityState } from "@/lib/profile/identity-types";

export type { ProfileIdentityState } from "@/lib/profile/identity-types";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Profile identity cards — Postgres-first for instant connector display. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    const authUser = data.user;

    if (!authUser) {
      return NextResponse.json({
        ok: true,
        signedIn: false,
        email: null,
        emailVerified: false,
        identities: [],
        ecosystems: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const profileRow = await loadProfileFast(authUser);
    const identities = buildFastIdentities(profileRow);

    const [liveConnectors, connectorStatuses, ecosystems] = await Promise.all([
      withTimeout(getConnectorLiveStatuses().catch(() => []), 1_200, []),
      withTimeout(getConnectorStatuses(authUser.id).catch(() => []), 1_200, []),
      withTimeout(
        listEcosystems(authUser.id).then((rows) =>
          rows.map((e) => ({
            id: e.id,
            name: e.name,
            kind: e.kind,
            connectors: e.connectors,
            repoCount: e.repos.length,
          })),
        ),
        2_000,
        [],
      ),
    ]);

    const githubLive = liveConnectors.find((c) => c.id === "github");
    const navidromeLive = liveConnectors.find((c) => c.id === "navidrome");
    const gmailStatus = connectorStatuses.find((c) => c.id === "gmail");
    const arcStatus = connectorStatuses.find((c) => c.id === "arc");

    const enriched: ProfileIdentityState[] = identities.map((row) => {
      if (row.id === "github" && githubLive) {
        return { ...row, health: githubLive.health, eventsToday: githubLive.eventsToday };
      }
      if (row.id === "navidrome" && navidromeLive) {
        return {
          ...row,
          connected: row.connected || (navidromeLive.installed ?? false),
          displayValue: row.displayValue ?? (navidromeLive.installed ? "Instance syncing" : undefined),
          health: navidromeLive.health,
          eventsToday: navidromeLive.eventsToday,
        };
      }
      if (row.id === "gmail" && gmailStatus?.state === "connected") {
        return { ...row, connected: true };
      }
      if (row.id === "wallet" && arcStatus?.state === "connected") {
        return { ...row, health: "healthy" };
      }
      return row;
    });

    return NextResponse.json(
      {
        ok: true,
        signedIn: true,
        email: authUser.email ?? null,
        emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
        identities: enriched,
        ecosystems,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    console.error("[profile/identities]", e);
    const message = e instanceof Error ? e.message : "identities_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
