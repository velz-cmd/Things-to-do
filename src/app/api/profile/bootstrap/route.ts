import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import { userListenBrainzConfigured, userNavidromeConfigured } from "@/lib/profile/user-connections";
import { safeUrlHostname } from "@/lib/profile/safe-url";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";
import type { ProfileIdentityState } from "@/app/api/profile/identities/route";

export const dynamic = "force-dynamic";

/**
 * Single profile load — one DB session instead of 5+ parallel API calls.
 * Reduces Supabase pool exhaustion on Vercel.
 */
export async function GET() {
  try {
    const authUser = await getSessionUser();
    if (!authUser) {
      return NextResponse.json({ ok: true, signedIn: false });
    }

    let profile = await ensureProfileForUser(authUser);
    profile = await sanitizeConnectorIdentities(authUser.id, profile);

    const walletAddress =
      profile.walletAddress?.toLowerCase() ??
      profile.scanWalletAddress?.toLowerCase() ??
      embeddedWalletFor(authUser.id).toLowerCase();

    const githubUsername = normalizeGithubLogin(profile.githubUsername);
    const listenbrainzConnected = userListenBrainzConfigured(profile);
    const navidromeConnected = userNavidromeConfigured(profile);

    const [liveConnectors, connectorStatuses, earnings, communities] = await Promise.all([
      getConnectorLiveStatuses().catch(() => []),
      getConnectorStatuses(authUser.id).catch(() => []),
      getProfileEarningsSummary({ profile }).catch(() => null),
      listCommunitySummaries(authUser.id).catch(() => []),
    ]);

    const githubLive = liveConnectors.find((c) => c.id === "github");
    const navidromeLive = liveConnectors.find((c) => c.id === "navidrome");
    const gmailStatus = connectorStatuses.find((c) => c.id === "gmail");
    const arcStatus = connectorStatuses.find((c) => c.id === "arc");
    const navidromeHost = safeUrlHostname(profile.navidromeUrl);

    const identities: ProfileIdentityState[] = [
      {
        id: "github",
        connected: Boolean(githubUsername),
        displayValue: githubUsername ? `@${githubUsername}` : undefined,
        hint: githubUsername ? undefined : "Install GitHub to claim code contributions",
        health: githubLive?.health,
        eventsToday: githubLive?.eventsToday,
        authorizeUrl: "/api/connectors/github/authorize?returnTo=/profile",
      },
      {
        id: "wallet",
        connected: true,
        displayValue: `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
        hint: "Your RESOLVE wallet on Arc — unique to your account",
        health: arcStatus?.state === "connected" ? "healthy" : "healthy",
      },
      {
        id: "navidrome",
        connected: navidromeConnected || (navidromeLive?.installed ?? false),
        displayValue:
          navidromeHost ?? (navidromeLive?.installed ? "Instance syncing" : undefined),
        hint:
          navidromeConnected || navidromeLive?.installed ?
            undefined
          : "Optional — ListenBrainz covers most listeners",
        health: navidromeLive?.health,
        eventsToday: navidromeLive?.eventsToday,
      },
      {
        id: "listenbrainz",
        connected: listenbrainzConnected,
        displayValue:
          profile.listenbrainzUsername ? `@${profile.listenbrainzUsername}` : undefined,
        hint: listenbrainzConnected ? undefined : "Install MusicBrainz — one click",
        authorizeUrl: "/api/connectors/listenbrainz/authorize?returnTo=/profile",
      },
      {
        id: "gmail",
        connected: profile.gmailConnected || gmailStatus?.state === "connected",
        displayValue: profile.gmailConnected ? "Inbox connected" : undefined,
        hint: profile.gmailConnected ? undefined : "Optional — receipt-based claims",
        authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
      },
    ];

    return NextResponse.json({
      ok: true,
      signedIn: true,
      email: authUser.email ?? null,
      emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
      identities,
      earnings,
      communities,
      wallet: {
        address: walletAddress,
        embedded: profile.embeddedWallet || true,
        provider: appWalletProvider(profile),
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[profile/bootstrap]", e);
    const message = e instanceof Error ? e.message : "profile_load_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
