import { NextResponse } from "next/server";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getCircleWalletSetId } from "@/lib/wallet/circle-config";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { listConfiguredProviders } from "@/lib/ai/gateway";
import { listSearchProviders, isSearchConfigured } from "@/lib/search";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import { isOpenCollectiveConfigured } from "@/lib/integrations/opencollective";
import { isDiscordConfigured } from "@/lib/integrations/discord";
import { isMastodonConfigured } from "@/lib/integrations/mastodon";
import { githubOAuthConfigured } from "@/lib/integrations/github-oauth";

/** Safe env presence check — never returns secret values. */
export async function GET() {
  const present = (key: string) => Boolean(process.env[key]?.trim());
  const circleWalletSetId = await getCircleWalletSetId();
  const ai = listConfiguredProviders();
  const search = listSearchProviders();

  const env = {
    APP_URL: present("APP_URL") || present("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_APP_URL: present("NEXT_PUBLIC_APP_URL"),
    PLAYWRIGHT_ENABLED: process.env.PLAYWRIGHT_ENABLED === "true",
    DATABASE_URL: present("DATABASE_URL"),
    DATABASE_PGBOUNCER: (process.env.DATABASE_URL ?? "").includes("pgbouncer=true"),
    DATABASE_POOL_LIMIT: (process.env.DATABASE_URL ?? "").includes("connection_limit=1"),
    NEXT_PUBLIC_REOWN_PROJECT_ID: present("NEXT_PUBLIC_REOWN_PROJECT_ID"),
    SUPABASE_URL: Boolean(getSupabaseServerUrl()),
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE: Boolean(getSupabaseServiceRoleKey()),
    RESEND_API_KEY: present("RESEND_API_KEY"),
    EMAIL_LOGIN_CODES: isSupabaseAdminConfigured() && present("RESEND_API_KEY"),
    CIRCLE_API_KEY: present("CIRCLE_API_KEY"),
    CIRCLE_ENTITY_SECRET: present("CIRCLE_ENTITY_SECRET"),
    CIRCLE_WALLET_SET_ID: present("CIRCLE_WALLET_SET_ID"),
    CIRCLE_WALLET_SET_CONFIGURED: Boolean(circleWalletSetId),
    ARC_CLIENT_WALLET_ADDRESS: present("ARC_CLIENT_WALLET_ADDRESS"),
    ARC_PROVIDER_WALLET_ADDRESS: present("ARC_PROVIDER_WALLET_ADDRESS"),
    ARC_RPC_URL: present("ARC_RPC_URL"),
    ARC_PROVIDER_WALLET_ID: present("ARC_PROVIDER_WALLET_ID"),
    ARC_CLIENT_WALLET_ID: present("ARC_CLIENT_WALLET_ID"),
    GEMINI_API_KEY: present("GEMINI_API_KEY") || present("GOOGLE_GENERATIVE_AI_API_KEY"),
    GROQ_API_KEY: present("GROQ_API_KEY"),
    OPENROUTER_API_KEY: present("OPENROUTER_API_KEY"),
    GOOGLE_CLIENT_ID: present("GOOGLE_CLIENT_ID") || present("GMAIL_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: present("GOOGLE_CLIENT_SECRET") || present("GMAIL_CLIENT_SECRET"),
    GOOGLE_REFRESH_TOKEN: present("GOOGLE_REFRESH_TOKEN"),
    GMAIL_OAUTH: googleOAuthConfigured(),
    GMAIL_LIVE: googleOAuthConfigured() && present("GOOGLE_REFRESH_TOKEN"),
    TAVILY_API_KEY: present("TAVILY_API_KEY"),
    SERPER_API_KEY: present("SERPER_API_KEY"),
    WEBSEARCH_API_KEY: present("WEBSEARCH_API_KEY"),
    SEARCH_CONFIGURED: isSearchConfigured(),
    GITHUB_TOKEN: present("GITHUB_TOKEN"),
    GITHUB_OAUTH: githubOAuthConfigured(),
    GITHUB_OAUTH_CLIENT_ID:
      present("GITHUB_OAUTH_CLIENT_ID") || present("GITHUB_CLIENT_ID"),
    GITHUB_OAUTH_CLIENT_SECRET:
      present("GITHUB_OAUTH_CLIENT_SECRET") || present("GITHUB_CLIENT_SECRET"),
    OPENCOLLECTIVE_TOKEN: present("OPENCOLLECTIVE_TOKEN"),
    DISCORD_BOT_TOKEN: present("DISCORD_BOT_TOKEN"),
    MASTODON_ACCESS_TOKEN: present("MASTODON_ACCESS_TOKEN"),
    MASTODON_INSTANCE_URL: present("MASTODON_INSTANCE_URL"),
    LIBRARIES_IO_API_KEY: present("LIBRARIES_IO_API_KEY"),
    NPM_REGISTRY_TOKEN: present("NPM_REGISTRY_TOKEN"),
    DOCKER_HUB_USERNAME: present("DOCKER_HUB_USERNAME"),
    DOCKER_HUB_TOKEN: present("DOCKER_HUB_TOKEN"),
    OPENALEX_API_KEY: present("OPENALEX_API_KEY"),
    BLOCKSCOUT_API_KEY: present("BLOCKSCOUT_API_KEY"),
    ETHERSCAN_API_KEY: present("ETHERSCAN_API_KEY"),
    CLOUDFLARE_GATEWAY: present("CLOUDFLARE_ACCOUNT_ID"),
    LISTENBRAINZ_TOKEN: present("LISTENBRAINZ_TOKEN"),
    LISTENBRAINZ_USERNAME: present("LISTENBRAINZ_USERNAME"),
    MUSICBRAINZ_CLIENT_ID: present("MUSICBRAINZ_CLIENT_ID"),
    MUSICBRAINZ_CLIENT_SECRET: present("MUSICBRAINZ_CLIENT_SECRET"),
    LASTFM_API_KEY: present("LASTFM_API_KEY"),
    LASTFM_USERNAME: present("LASTFM_USERNAME"),
    NAVIDROME_URL: present("NAVIDROME_URL"),
    NAVIDROME_USERNAME: present("NAVIDROME_USERNAME"),
    NAVIDROME_PASSWORD: present("NAVIDROME_PASSWORD"),
    NAVIDROME_SYNC_SECRET: present("NAVIDROME_SYNC_SECRET"),
    NAVIDROME_PROGRAM_MISSION_ID: present("NAVIDROME_PROGRAM_MISSION_ID"),
    RESOLVE_PLATFORM_FEE_BPS: present("RESOLVE_PLATFORM_FEE_BPS"),
    CLAIM_TOKEN_SECRET: present("CLAIM_TOKEN_SECRET") || present("CRON_SECRET"),
    ARC_AGENT_GATEWAY_PRIVATE_KEY: present("ARC_AGENT_GATEWAY_PRIVATE_KEY"),
    ALCHEMY_API_KEY: present("ALCHEMY_API_KEY"),
    WALLET_LABELS_API_KEY: present("WALLET_LABELS_API_KEY"),
  };

  const aiReady = ai.gemini || ai.groq || ai.openrouter;
  const communitySensorsReady =
    isOpenCollectiveConfigured() || isDiscordConfigured() || isMastodonConfigured();

  const missing: string[] = [];
  if (!env.PLAYWRIGHT_ENABLED) missing.push("PLAYWRIGHT_ENABLED=true");
  if (!env.APP_URL) missing.push("APP_URL=https://resolve-task.vercel.app");
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!aiReady) missing.push("GROQ_API_KEY or GEMINI_API_KEY or OPENROUTER_API_KEY");
  if (!env.SEARCH_CONFIGURED) missing.push("TAVILY_API_KEY or SERPER_API_KEY");
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN (optional — higher GitHub rate limits)");
  if (!env.NEXT_PUBLIC_REOWN_PROJECT_ID) missing.push("NEXT_PUBLIC_REOWN_PROJECT_ID");

  return NextResponse.json({
    ok: true,
    deploy: "env-diagnostic-v2",
    env,
    capabilities: {
      ai: aiReady,
      search: env.SEARCH_CONFIGURED,
      database: env.DATABASE_URL,
      walletConnect: env.NEXT_PUBLIC_REOWN_PROJECT_ID,
      gmail: env.GMAIL_LIVE,
      communitySensors: communitySensorsReady,
      githubObservation: env.GITHUB_TOKEN || "public_api",
    },
    ai: {
      gemini: ai.gemini,
      groq: ai.groq,
      openrouter: ai.openrouter,
      cloudflareGateway: ai.cloudflareGateway,
      tiers: ai.tiers,
    },
    search,
    arc: {
      liveEnabled: isLiveArcEnabled(),
      blockers: getLiveBlockers(),
    },
    missingRecommended: missing,
  });
}
