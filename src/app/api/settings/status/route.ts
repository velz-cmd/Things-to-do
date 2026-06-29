import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth/session";
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
import { INTEGRATIONS } from "@/lib/integrations/config";
import { isNavidromeConfigured } from "@/lib/integrations/navidrome";
import {
  claimTokenSecretHasWhitespace,
  cronSecretHasWhitespace,
  getClaimTokenSecret,
  getCronSecret,
} from "@/lib/env/cron-secret";
import { safeUrlHostname } from "@/lib/profile/safe-url";
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
  { name: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Auth (Supabase)", required: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Auth admin + email codes", required: true },
  { name: "RESEND_API_KEY", purpose: "Earn notifications", required: false },
  { name: "ARC_FUNDING_PRIVATE_KEY", purpose: "On-chain settlement", required: false },
  { name: "GITHUB_TOKEN", purpose: "Optional — higher GitHub API rate limits (users sync via OAuth)", required: false },
  { name: "OPENALEX_API_KEY", purpose: "Optional — higher OpenAlex limits (public API works globally)", required: false, altKeys: ["OPENALEX_EMAIL"] },
  { name: "MUSICBRAINZ_CLIENT_ID", purpose: "ListenBrainz OAuth sign-in", required: false },
  { name: "MUSICBRAINZ_CLIENT_SECRET", purpose: "ListenBrainz OAuth sign-in", required: false },
  { name: "GOOGLE_REFRESH_TOKEN", purpose: "Operator Gmail inbox", required: false },
] as const;

function envPresent(key: string, altKeys: string[] = []): boolean {
  if (Boolean(process.env[key]?.trim())) return true;
  return altKeys.some((k) => Boolean(process.env[k]?.trim()));
}

/** Settings aggregate — real user connections + platform sensors + operator keys */
export async function GET() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const authUser = data.user;

  let profileRow: Awaited<ReturnType<typeof ensureProfileForUser>> | null = null;
  let githubUsername: string | null = null;
  let walletAddress: string | null = null;
  let gmailConnected = false;

  if (authUser) {
    profileRow = await ensureProfileForUser(authUser);
    githubUsername = profileRow.githubUsername ?? null;
    walletAddress =
      profileRow.walletAddress ??
      profileRow.scanWalletAddress ??
      null;
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
  const resendStatus = deputyConnectors.find((c) => c.id === "resend");

  const listenbrainzConnected = profileRow ? userListenBrainzConfigured(profileRow) : false;
  const navidromeConnected = profileRow ? userNavidromeConfigured(profileRow) : false;

  const email = authUser?.email ?? null;
  const emailVerified = Boolean(authUser?.email_confirmed_at ?? authUser?.email);
  const operatorGmailLive =
    googleOAuthConfigured() && Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim());
  const operatorNavidrome = isNavidromeConfigured();

  const connections: SettingsConnection[] =
    authUser ?
      [
        {
          id: "email",
          label: "Email sign-in",
          connected: Boolean(email),
          displayValue: email ?? undefined,
          hint:
            email ?
              emailVerified ? "Verified Supabase account" : "Check inbox to verify"
            : undefined,
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
            : "Add GitHub on Profile or sign in with GitHub",
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
          hint:
            walletAddress ?
              "Auto-provisioned RESOLVE wallet on Arc"
            : "Sign in — wallet provisions on first session",
          managePath: "/profile",
        },
        {
          id: "navidrome",
          label: "Navidrome (your instance)",
          connected: navidromeConnected,
          displayValue:
            safeUrlHostname(profileRow?.navidromeUrl) ?? undefined,
          hint: navidromeConnected ? undefined : "Optional — connect on Profile",
          health: navidromeConnected ? navidromeLive?.health : undefined,
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
          label: "Gmail inbox (yours)",
          connected: gmailConnected,
          displayValue: gmailConnected ? "Personal inbox linked" : undefined,
          hint:
            gmailConnected ?
              undefined
            : operatorGmailLive ?
              "Operator Gmail is configured on Vercel — link your inbox here if needed"
            : "Optional — receipt evidence for Deputy claims",
          managePath: "/api/connectors/gmail/authorize?returnTo=/settings",
        },
      ]
    : [];

  const operatorIntegrations = [
    {
      id: "github-sensor",
      label: "GitHub sensor",
      configured: envPresent("GITHUB_TOKEN"),
      detail: githubLive ? `${githubLive.authorizationCount} ledger events` : "No events yet",
      health: githubLive?.health,
    },
    {
      id: "openalex-sensor",
      label: "OpenAlex sensor",
      configured: INTEGRATIONS.openAlex(),
      detail: openAlexLive ? `${openAlexLive.authorizationCount} citation events` : "Not configured",
      health: openAlexLive?.health,
    },
    {
      id: "navidrome-sensor",
      label: "Navidrome sensor",
      configured: operatorNavidrome,
      detail: navidromeLive?.installed ? "Platform bridge active" : "Awaiting NAVIDROME_* env",
      health: navidromeLive?.health,
    },
    {
      id: "gmail-operator",
      label: "Gmail (operator)",
      configured: operatorGmailLive,
      detail: operatorGmailLive ? "OAuth + refresh token on Vercel" : "GOOGLE_* not complete",
    },
    {
      id: "resend",
      label: "Resend email",
      configured: envPresent("RESEND_API_KEY"),
      detail: envPresent("RESEND_API_KEY") ? "Earn notifications enabled" : "RESEND_API_KEY missing",
    },
    {
      id: "supabase",
      label: "Supabase auth",
      configured: envPresent("NEXT_PUBLIC_SUPABASE_URL") && envPresent("SUPABASE_SERVICE_ROLE_KEY"),
      detail: "Sign-in + profile storage",
    },
  ];

  const ai = listConfiguredProviders();
  const hasLlm =
    ai.gemini || ai.groq || ai.openrouter || Boolean(process.env.DASHSCOPE_API_KEY);

  const operatorKeys = OPERATOR_KEYS.map((k) => ({
    name: k.name,
    purpose: k.purpose,
    required: k.required,
    configured: envPresent(k.name, "altKeys" in k ? [...k.altKeys] : []),
  }));

  return NextResponse.json({
    ok: true,
    signedIn: Boolean(authUser),
    connections,
    operatorIntegrations,
    distributionSensors: liveSensors.filter((c) => c.catalogStatus === "live"),
    communitySensors: sensorCommunities,
    platform: {
      llmEnabled: hasLlm,
      resendEnabled: resendStatus?.state === "ready" || envPresent("RESEND_API_KEY"),
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
