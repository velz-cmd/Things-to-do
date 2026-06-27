import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { isNavidromeConfigured } from "@/lib/integrations/navidrome";
import { env } from "@/lib/integrations/config";
import { prisma } from "@/lib/db";
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

  if (authUser) {
    userId = authUser.id;
    email = authUser.email ?? null;
    emailVerified = Boolean(authUser.email_confirmed_at ?? authUser.email);
    const profile = await ensureProfileForUser(authUser);
    const gh = extractGithubIdentity(authUser);
    githubUsername = gh.login ?? profile.githubUsername ?? null;
    walletAddress = profile.scanWalletAddress ?? profile.walletAddress ?? null;
    gmailConnected = profile.gmailConnected;
  }

  const [liveConnectors, connectorStatuses] = await Promise.all([
    getConnectorLiveStatuses().catch(() => []),
    getConnectorStatuses(userId).catch(() => []),
  ]);

  const githubLive = liveConnectors.find((c) => c.id === "github");
  const navidromeLive = liveConnectors.find((c) => c.id === "navidrome");
  const gmailStatus = connectorStatuses.find((c) => c.id === "gmail");
  const arcStatus = connectorStatuses.find((c) => c.id === "arc");

  const listenbrainzUser = env("LISTENBRAINZ_USERNAME");
  const navidromeUrl = env("NAVIDROME_URL");

  const ecosystems =
    userId ?
      await prisma.resolveEcosystem.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          kind: true,
          connectorsJson: true,
          reposJson: true,
        },
      })
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
      connected: isNavidromeConfigured() || (navidromeLive?.installed ?? false),
      displayValue:
        navidromeUrl ?
          new URL(navidromeUrl).hostname
        : navidromeLive?.installed ?
          "Instance syncing"
        : undefined,
      hint:
        isNavidromeConfigured() || navidromeLive?.installed ?
          undefined
        : "Point RESOLVE at your Navidrome instance",
      health: navidromeLive?.health,
      eventsToday: navidromeLive?.eventsToday,
    },
    {
      id: "listenbrainz",
      connected: isListenBrainzConfigured(),
      displayValue: listenbrainzUser ? `@${listenbrainzUser}` : undefined,
      hint: isListenBrainzConfigured() ? undefined : "Set LISTENBRAINZ_USERNAME on deploy",
      health: navidromeLive?.health,
    },
    {
      id: "gmail",
      connected: gmailConnected || gmailStatus?.state === "connected",
      displayValue: gmailConnected ? "Inbox connected" : undefined,
      hint: gmailConnected ? undefined : "Optional — for receipt-based claims",
      authorizeUrl: "/api/connectors/gmail/authorize",
    },
    {
      id: "mastodon",
      connected: false,
      hint: "Coming soon — ActivityPub attribution",
    },
    {
      id: "peertube",
      connected: false,
      hint: "Coming soon — video creator payouts",
    },
  ];

  return NextResponse.json({
    ok: true,
    signedIn: Boolean(authUser),
    email,
    emailVerified,
    identities,
    ecosystems: ecosystems.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      connectors: JSON.parse(e.connectorsJson || "[]") as string[],
      repoCount: (JSON.parse(e.reposJson || "[]") as unknown[]).length,
    })),
    updatedAt: new Date().toISOString(),
  });
}
