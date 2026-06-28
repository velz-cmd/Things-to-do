import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";
import {
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";
import { describeSwarmCapabilities, listConfiguredProviders } from "@/lib/ai/gateway";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import {
  claimTokenSecretHasWhitespace,
  cronSecretHasWhitespace,
  getClaimTokenSecret,
  getCronSecret,
} from "@/lib/env/cron-secret";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

export type SettingsConnection = {
  id: string;
  label: string;
  connected: boolean;
  displayValue?: string;
  hint?: string;
  health?: string;
  eventsToday?: number;
  managePath?: string;
};

const OPERATOR_KEYS = [
  { name: "DATABASE_URL", purpose: "Ledger + authorizations", required: true },
  { name: "CRON_SECRET", purpose: "Scheduled sensor ticks", required: true },
  { name: "CLAIM_TOKEN_SECRET", purpose: "Signed claim links", required: true },
  { name: "RESEND_API_KEY", purpose: "Earn notifications", required: false },
  { name: "ARC_FUNDING_PRIVATE_KEY", purpose: "On-chain settlement", required: false },
  { name: "GITHUB_TOKEN", purpose: "Code sensor (server)", required: false },
  { name: "OPENALEX_EMAIL", purpose: "Research sensor politeness", required: false },
] as const;

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

/** Settings aggregate — real user connections + platform sensors + operator keys */
export async function GET() {
  const present = envPresent;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const authUser = data.user;

  let profileRow: Awaited<ReturnType<typeof ensureProfileForUser>> | null = null;
  let githubUsername: string | null = null;
  let walletAddress: string | null = null;
  let gmailConnected = false;

  if (authUser) {
    profileRow = await ensureProfileForUser(authUser);
    const gh = extractGithubIdentity(authUser);
    githubUsername = gh.login ?? profileRow.githubUsername ?? null;
    walletAddress = profileRow.scanWalletAddress ?? profileRow.walletAddress ?? null;
    gmailConnected = profileRow.gmailConnected;
  }

  const [liveSensors, deputyConnectors, sensorCommunities, arcReadiness] = await Promise.all([
    getConnectorLiveStatuses().catch(() => []),
    getConnectorStatuses(authUser?.id ?? null).catch(() => []),
    getCommunitySensorStatuses().catch(() => []),
    getArcReadiness().catch(() => null),
  ]);

  const githubLive = liveSensors.find((c) => c.id === "github");
  const openAlexLive = liveSensors.find((c) => c.id === "openalex");
  const navidromeLive = liveSensors.find((c) => c.id === "navidrome");
  const gmailStatus = deputyConnectors.find((c) => c.id === "gmail");
  const resendStatus = deputyConnectors.find((c) => c.id === "resend");

  const listenbrainzConnected = profileRow ? userListenBrainzConfigured(profileRow) : false;
  const navidromeConnected = profileRow ? userNavidromeConfigured(profileRow) : false;

  const email = authUser?.email ?? null;
  const emailVerified = Boolean(authUser?.email_confirmed_at ?? authUser?.email);

  const connections: SettingsConnection[] = [
    {
      id: "email",
      label: "Email sign-in",
      connected: Boolean(email),
      displayValue: email ?? undefined,
      hint: email ? (emailVerified ? "Verified" : "Check inbox to verify") : "Sign in from Profile",
      managePath: "/profile",
    },
    {
      id: "github",
      label: "GitHub identity",
      connected: Boolean(githubUsername),
      displayValue: githubUsername ? `@${githubUsername}` : undefined,
      hint:
        githubUsername ?
          "Linked for code attribution and claims"
        : "Sign in with GitHub or link on Profile",
      health: githubLive?.health,
      eventsToday: githubLive?.eventsToday,
      managePath: "/profile",
    },
    {
      id: "wallet",
      label: "Arc wallet",
      connected: Boolean(walletAddress),
      displayValue:
        walletAddress ?
          `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
        : undefined,
      hint: walletAddress ? "Payout destination on Arc" : "Connect wallet on Profile to claim",
      managePath: "/profile",
    },
    {
      id: "navidrome",
      label: "Navidrome",
      connected: navidromeConnected || (navidromeLive?.installed ?? false),
      displayValue:
        profileRow?.navidromeUrl ?
          new URL(profileRow.navidromeUrl).hostname
        : navidromeLive?.installed ?
          "Platform sensor active"
        : undefined,
      hint:
        navidromeConnected ? undefined : (
          "Optional — connect your instance on Profile"
        ),
      health: navidromeLive?.health,
      eventsToday: navidromeLive?.eventsToday,
      managePath: "/profile",
    },
    {
      id: "listenbrainz",
      label: "ListenBrainz",
      connected: listenbrainzConnected,
      displayValue:
        profileRow?.listenbrainzUsername ?
          `@${profileRow.listenbrainzUsername}`
        : undefined,
      hint: listenbrainzConnected ? undefined : "Optional — music attribution on Profile",
      managePath: "/profile",
    },
    {
      id: "gmail",
      label: "Gmail inbox",
      connected: gmailConnected || gmailStatus?.state === "connected",
      displayValue: gmailConnected ? "Inbox connected" : undefined,
      hint: "Optional — receipt evidence for Deputy claims",
      managePath: "/api/connectors/gmail/authorize?returnTo=/settings",
    },
  ];

  const ai = listConfiguredProviders();
  const hasLlm =
    ai.gemini || ai.groq || ai.openrouter || Boolean(process.env.DASHSCOPE_API_KEY);

  const operatorKeys = OPERATOR_KEYS.map((k) => ({
    ...k,
    configured: present(k.name),
  }));

  return NextResponse.json({
    ok: true,
    signedIn: Boolean(authUser),
    connections,
    distributionSensors: liveSensors.filter((c) => c.catalogStatus === "live"),
    communitySensors: sensorCommunities,
    platform: {
      llmEnabled: hasLlm,
      resendEnabled: resendStatus?.state === "ready" || present("RESEND_API_KEY"),
      arcMemos: {
        enabled: isLiveArcEnabled(),
        canDistributeOnChain: arcReadiness?.canDistributeOnChain ?? false,
        message: arcReadiness?.message ?? "Arc treasury status unavailable",
      },
      gmailOAuth: googleOAuthConfigured(),
    },
    operatorKeys,
    cron: {
      configured: Boolean(getCronSecret()),
      runtimeOk: Boolean(getCronSecret()),
      whitespace: cronSecretHasWhitespace(),
      claimTokenConfigured: Boolean(getClaimTokenSecret()),
      claimTokenWhitespace: claimTokenSecretHasWhitespace(),
    },
    swarm: describeSwarmCapabilities(),
    updatedAt: new Date().toISOString(),
  });
}
