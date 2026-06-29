import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import { listEcosystems, ensureSeedEcosystems } from "@/lib/mission/server/ecosystems";
import {
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";
import type { IdentityPlatformId } from "@/lib/profile/community-identities";

export type ProfileIdentityState = {
  id: IdentityPlatformId;
  connected: boolean;
  displayValue?: string;
  hint?: string;
  health?: string;
  eventsToday?: number;
  authorizeUrl?: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const authUser = data.user;

  let userId: string | null = null;
  let email: string | null = null;
  let emailVerified = false;
  let githubUsername: string | null = null;
  let walletAddress: string | null = null;
  let gmailConnected = false;
  let profileRow: Awaited<ReturnType<typeof ensureProfileForUser>> | null = null;

  if (authUser) {
    userId = authUser.id;
    email = authUser.email ?? null;
    emailVerified = Boolean(authUser.email_confirmed_at ?? authUser.email);
    profileRow = await ensureProfileForUser(authUser);
    const gh = extractGithubIdentity(authUser);
    githubUsername = gh.login ?? profileRow.githubUsername ?? null;
    walletAddress =
      profileRow.walletAddress ??
      profileRow.scanWalletAddress ??
      null;
    gmailConnected = profileRow.gmailConnected;
    await ensureSeedEcosystems(authUser.id);
  }

  const [liveConnectors, connectorStatuses] = await Promise.all([
    getConnectorLiveStatuses().catch(() => []),
    getConnectorStatuses(userId).catch(() => []),
  ]);

  const githubLive = liveConnectors.find((c) => c.id === "github");
  const navidromeLive = liveConnectors.find((c) => c.id === "navidrome");
  const gmailStatus = connectorStatuses.find((c) => c.id === "gmail");
  const arcStatus = connectorStatuses.find((c) => c.id === "arc");

  const listenbrainzConnected =
    profileRow ? userListenBrainzConfigured(profileRow) : false;
  const navidromeConnected = profileRow ? userNavidromeConfigured(profileRow) : false;

  const ecosystems =
    userId ?
      await listEcosystems(userId).then((rows) =>
        rows.map((e) => ({
          id: e.id,
          name: e.name,
          kind: e.kind,
          connectors: e.connectors,
          repoCount: e.repos.length,
        })),
      )
    : [];

  const identities: ProfileIdentityState[] = [
    {
      id: "github",
      connected: Boolean(githubUsername),
      displayValue: githubUsername ? `@${githubUsername}` : undefined,
      hint: githubUsername ? undefined : "Required to claim code contributions",
      health: githubLive?.health,
      eventsToday: githubLive?.eventsToday,
    },
    {
      id: "wallet",
      connected: Boolean(walletAddress),
      displayValue:
        walletAddress ?
          `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
        : undefined,
      hint: walletAddress ? undefined : "Connect to receive USDC on Arc",
      health: arcStatus?.state === "connected" ? "healthy" : "waiting",
    },
    {
      id: "navidrome",
      connected: navidromeConnected || (navidromeLive?.installed ?? false),
      displayValue:
        profileRow?.navidromeUrl ?
          new URL(profileRow.navidromeUrl).hostname
        : navidromeLive?.installed ?
          "Instance syncing"
        : undefined,
      hint:
        navidromeConnected || navidromeLive?.installed ?
          undefined
        : "Optional — ListenBrainz sign-in covers most music listeners",
      health: navidromeLive?.health,
      eventsToday: navidromeLive?.eventsToday,
    },
    {
      id: "listenbrainz",
      connected: listenbrainzConnected,
      displayValue:
        profileRow?.listenbrainzUsername ?
          `@${profileRow.listenbrainzUsername}`
        : undefined,
      hint: listenbrainzConnected ? undefined : "Sign in with MusicBrainz — one click, no token",
      authorizeUrl: "/api/connectors/listenbrainz/authorize?returnTo=/profile",
    },
    {
      id: "gmail",
      connected: gmailConnected || gmailStatus?.state === "connected",
      displayValue: gmailConnected ? "Inbox connected" : undefined,
      hint: gmailConnected ? undefined : "Optional — for receipt-based claims",
      authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
    },
  ];

  return NextResponse.json({
    ok: true,
    signedIn: Boolean(authUser),
    email,
    emailVerified,
    identities,
    ecosystems,
    updatedAt: new Date().toISOString(),
  });
}
