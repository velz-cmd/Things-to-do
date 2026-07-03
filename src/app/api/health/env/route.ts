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
import { analyzeDatabaseUrl, getDatabaseDiagnostics, listPresentDatabaseEnvKeys } from "@/lib/db/connection";
import { getAuthEmailDeliveryStatus } from "@/lib/email/deliver";
import { isRedisConfigured } from "@/lib/cache/redis";

/** Safe env presence check — never returns secret values. */
export async function GET() {
  const present = (key: string) => Boolean(process.env[key]?.trim());
  const circleWalletSetId = await getCircleWalletSetId();
  const ai = listConfiguredProviders();
  const search = listSearchProviders();
  const db = getDatabaseDiagnostics();
  const databaseEnvKeysPresent = listPresentDatabaseEnvKeys();

  const env = {
    APP_URL: present("APP_URL") || present("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_APP_URL: present("NEXT_PUBLIC_APP_URL"),
    PLAYWRIGHT_ENABLED: process.env.PLAYWRIGHT_ENABLED === "true",
    DATABASE_URL: db.configured,
    DATABASE_ENV_SOURCE: db.envSource,
    DATABASE_ENV_KEYS_PRESENT: databaseEnvKeysPresent,
    /** True when Vercel string literally contains pgbouncer=true (Supabase UI omits this). */
    DATABASE_PGBOUNCER_RAW: db.rawHasPgbouncerParam,
    /** True after app auto-appends params at runtime (what Prisma actually uses). */
    DATABASE_PGBOUNCER: db.normalizedHasPgbouncerParam,
    DATABASE_POOL_LIMIT_RAW: db.rawHasConnectionLimit,
    DATABASE_POOL_LIMIT: db.normalizedHasConnectionLimit,
    DATABASE_TRANSACTION_POOLER: db.isTransactionPooler,
    DATABASE_SESSION_POOLER: db.isSessionPooler,
    DATABASE_DIRECT_SUPABASE: db.isDirectSupabase,
    DATABASE_PRISMA_READY: db.prismaReady,
    DATABASE_PORT_REWRITTEN: db.portRewritten,
    DATABASE_NORMALIZED_PORT: db.normalizedPort,
    DATABASE_POOLER_PORT_6543: db.normalizedPort === 6543 || db.port === 6543,
    DATABASE_POOLER_PORT_5432: db.port === 5432 && !db.portRewritten,
    DATABASE_HOST: db.host,
    NEXT_PUBLIC_REOWN_PROJECT_ID: present("NEXT_PUBLIC_REOWN_PROJECT_ID"),
    SUPABASE_URL: Boolean(getSupabaseServerUrl()),
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE: Boolean(getSupabaseServiceRoleKey()),
    RESEND_API_KEY: present("RESEND_API_KEY"),
    RESEND_FROM_EMAIL: present("RESEND_FROM_EMAIL"),
    BREVO_API_KEY: present("BREVO_API_KEY"),
    BREVO_FROM_EMAIL: present("BREVO_FROM_EMAIL"),
    BREVO_FROM_NAME: present("BREVO_FROM_NAME"),
    EMAIL_AUTH_DELIVERY: getAuthEmailDeliveryStatus(),
    UPSTASH_REDIS_REST_URL: present("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: present("UPSTASH_REDIS_REST_TOKEN"),
    REDIS_CACHE: isRedisConfigured(),
    EMAIL_LOGIN_CODES:
      isSupabaseAdminConfigured() &&
      (present("RESEND_API_KEY") || present("BREVO_API_KEY")),
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
    JELLYFIN_URL: present("JELLYFIN_URL"),
    JELLYFIN_API_KEY: present("JELLYFIN_API_KEY"),
    JELLYFIN_SYNC_SECRET: present("JELLYFIN_SYNC_SECRET"),
    NAVIDROME_URL: present("NAVIDROME_URL"),
    NAVIDROME_USERNAME: present("NAVIDROME_USERNAME"),
    NAVIDROME_PASSWORD: present("NAVIDROME_PASSWORD"),
    NAVIDROME_SYNC_SECRET: present("NAVIDROME_SYNC_SECRET"),
    NAVIDROME_PROGRAM_MISSION_ID: present("NAVIDROME_PROGRAM_MISSION_ID"),
    RESOLVE_PLATFORM_FEE_BPS: present("RESOLVE_PLATFORM_FEE_BPS"),
    RESOLVE_PLATFORM_FEE_WALLET: present("RESOLVE_PLATFORM_FEE_WALLET"),
    CLAIM_TOKEN_SECRET: present("CLAIM_TOKEN_SECRET") || present("CRON_SECRET"),
    DEPUTY_DEMO_MODE: process.env.DEPUTY_DEMO_MODE === "true",
    ARC_AGENT_GATEWAY_PRIVATE_KEY: present("ARC_AGENT_GATEWAY_PRIVATE_KEY"),
    ALCHEMY_API_KEY: present("ALCHEMY_API_KEY"),
    ALCHEMY_ARC_RPC_URL: present("ALCHEMY_ARC_RPC_URL"),
    WALLET_LABELS_API_KEY: present("WALLET_LABELS_API_KEY"),
    ALLOW_LIVE_GITHUB_SCAN: process.env.ALLOW_LIVE_GITHUB_SCAN === "true",
  };

  const aiReady = ai.gemini || ai.groq || ai.openrouter;
  const communitySensorsReady =
    isOpenCollectiveConfigured() || isDiscordConfigured() || isMastodonConfigured();

  const missing: string[] = [];
  if (!env.PLAYWRIGHT_ENABLED) missing.push("PLAYWRIGHT_ENABLED=true");
  if (!env.APP_URL) missing.push("APP_URL=https://things-to-do-eta.vercel.app");
  if (!env.DATABASE_URL) {
    missing.push(
      "DATABASE_URL — add in Vercel, check Production + Preview boxes, then Redeploy (env vars do not apply until redeploy)",
    );
  }
  if (db.isSessionPooler && !db.portRewritten) {
    missing.push(
      "DATABASE_URL port 5432 on pooler.supabase.com is session mode — use transaction pooler port 6543",
    );
  }
  if (db.isDirectSupabase) {
    missing.push(
      "DATABASE_URL points at direct db.*.supabase.co — use pooler.supabase.com:6543 on Vercel",
    );
  }
  if (db.isTransactionPooler && !db.rawHasPgbouncerParam) {
    missing.push(
      "DATABASE_URL missing ?pgbouncer=true (app auto-adds at runtime; optional in Vercel)",
    );
  }
  if (!aiReady) missing.push("GROQ_API_KEY or GEMINI_API_KEY or OPENROUTER_API_KEY");
  if (!env.SEARCH_CONFIGURED) missing.push("TAVILY_API_KEY or SERPER_API_KEY");
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN (optional — higher GitHub rate limits)");
  if (!env.NEXT_PUBLIC_REOWN_PROJECT_ID) missing.push("NEXT_PUBLIC_REOWN_PROJECT_ID");

  return NextResponse.json({
    ok: true,
    deploy: "env-diagnostic-v4",
    env,
    database: {
      host: db.host,
      port: db.port,
      normalizedPort: db.normalizedPort,
      portRewritten: db.portRewritten,
      mode:
        db.isTransactionPooler ? "transaction"
        : db.isSessionPooler ? "session"
        : db.isDirectSupabase ? "direct"
        : db.configured ? "unknown"
        : "unset",
      prismaReady: db.prismaReady,
      note:
        db.portRewritten ?
          "Vercel DATABASE_URL uses session port 5432 — RESOLVE auto-rewrites to transaction port 6543 at runtime. Update Vercel to 6543 when you can."
        : db.isTransactionPooler && !db.rawHasPgbouncerParam ?
          "Transaction pooler detected (port 6543). Supabase UI does not add pgbouncer=true — RESOLVE appends it automatically."
        : db.isSessionPooler ?
          "Session pooler (port 5432) exhausts at ~15 connections on serverless — switch to transaction pooler (6543)."
        : undefined,
    },
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
