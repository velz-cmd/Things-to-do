import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getProfileEarningsSummaryCached } from "@/lib/earn/earnings-snapshot";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import { userJellyfinConfigured } from "@/lib/profile/user-connections";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import { resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";
import { isDbPoolExhaustedError } from "@/lib/db/connection";
import { offlineProfileBootstrap } from "@/lib/profile/bootstrap-fallback";
import { loadProfileFast } from "@/lib/profile/load-profile-fast";
import { buildFastIdentities } from "@/lib/profile/build-fast-identities";
import type { ProfileIdentityState } from "@/lib/profile/identity-types";
import { API_CACHE } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";
import { cacheGetOrSet } from "@/lib/cache/kv";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function enrichIdentities(
  identities: ProfileIdentityState[],
  liveConnectors: Awaited<ReturnType<typeof getConnectorLiveStatuses>>,
  connectorStatuses: Awaited<ReturnType<typeof getConnectorStatuses>>,
): ProfileIdentityState[] {
  const githubLive = liveConnectors.find((c) => c.id === "github");
  const navidromeLive = liveConnectors.find((c) => c.id === "navidrome");
  const gmailStatus = connectorStatuses.find((c) => c.id === "gmail");

  return identities.map((row) => {
    if (row.id === "github" && githubLive) {
      return { ...row, health: githubLive.health, eventsToday: githubLive.eventsToday };
    }
    if (row.id === "navidrome" && navidromeLive) {
      return {
        ...row,
        connected: row.connected || (navidromeLive.installed ?? false),
        health: navidromeLive.health,
        eventsToday: navidromeLive.eventsToday,
      };
    }
    if (row.id === "gmail" && gmailStatus?.state === "connected") {
      return { ...row, connected: true };
    }
    return row;
  });
}

async function fastBootstrapPayload(authUser: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) {
  const profile = await loadProfileFast(authUser);
  const walletResolved = resolveUserWallet(authUser.id, profile);
  const identities = buildFastIdentities(profile);
  const jellyfinConnected = userJellyfinConfigured(profile);

  return {
    profile,
    walletResolved,
    identities,
    jellyfinConnected,
  };
}

/**
 * Single profile load — connector fields from Postgres first (fast), enrich in parallel with timeouts.
 */
export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: true, signedIn: false });
  }

  const rl = await rateLimitRequest(
    `profile:bootstrap:${getRequestClientId(req, authUser.id)}`,
    30,
    60,
  );
  if (!rl.success) {
    try {
      const { profile, walletResolved, identities, jellyfinConnected } =
        await fastBootstrapPayload(authUser);
      return NextResponse.json(
        {
          ok: true,
          signedIn: true,
          userId: authUser.id,
          email: authUser.email ?? null,
          emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
          identities,
          earnings: null,
          communities: [],
          wallet: {
            address: walletResolved.address,
            embedded: profile.embeddedWallet || true,
            provider: appWalletProvider(profile),
          },
          jellyfinSync:
            jellyfinConnected && profile.jellyfinUrl && profile.jellyfinAccessToken
              ? { url: profile.jellyfinUrl, accessToken: profile.jellyfinAccessToken }
              : null,
          rateLimited: true,
          dbDegraded: true,
          updatedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": API_CACHE.noStore } },
      );
    } catch {
      return NextResponse.json(offlineProfileBootstrap(authUser));
    }
  }

  try {
    const payload = await cacheGetOrSet(`profile:bootstrap:${authUser.id}`, 30, async () => {
      const { profile, walletResolved, identities: fastIdentities, jellyfinConnected } =
        await fastBootstrapPayload(authUser);

      const [liveConnectors, connectorStatuses, earnings, communities] = await Promise.all([
        withTimeout(getConnectorLiveStatuses().catch(() => []), 1_500, []),
        withTimeout(getConnectorStatuses(authUser.id).catch(() => []), 1_500, []),
        withTimeout(
          getProfileEarningsSummaryCached({ userId: authUser.id, profile }).catch(() => null),
          2_000,
          null,
        ),
        withTimeout(listCommunitySummaries(authUser.id, { fast: true }).catch(() => []), 2_500, []),
      ]);

      const identities = enrichIdentities(fastIdentities, liveConnectors, connectorStatuses);

      return {
        ok: true,
        signedIn: true,
        userId: authUser.id,
        email: authUser.email ?? null,
        emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
        identities,
        earnings,
        communities,
        wallet: {
          address: walletResolved.address,
          embedded: profile.embeddedWallet || true,
          provider: appWalletProvider(profile),
        },
        jellyfinSync:
          jellyfinConnected && profile.jellyfinUrl && profile.jellyfinAccessToken
            ? {
                url: profile.jellyfinUrl,
                accessToken: profile.jellyfinAccessToken,
              }
            : null,
        updatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": API_CACHE.privateShort },
    });
  } catch (e) {
    reportApiError("profile/bootstrap", e, { userId: authUser.id });
    try {
      const { profile, walletResolved, identities, jellyfinConnected } =
        await fastBootstrapPayload(authUser);
      return NextResponse.json({
        ok: true,
        signedIn: true,
        userId: authUser.id,
        email: authUser.email ?? null,
        emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
        identities,
        earnings: null,
        communities: [],
        wallet: {
          address: walletResolved.address,
          embedded: profile.embeddedWallet || true,
          provider: appWalletProvider(profile),
        },
        jellyfinSync:
          jellyfinConnected && profile.jellyfinUrl && profile.jellyfinAccessToken
            ? {
                url: profile.jellyfinUrl,
                accessToken: profile.jellyfinAccessToken,
              }
            : null,
        dbDegraded: true,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      if (isDbPoolExhaustedError(e)) {
        return NextResponse.json(offlineProfileBootstrap(authUser));
      }
      return NextResponse.json(offlineProfileBootstrap(authUser));
    }
  }
}
