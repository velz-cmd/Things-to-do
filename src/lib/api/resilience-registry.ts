/**
 * Single source of truth for cache TTLs, rate limits, and hardened routes.
 * Referenced by GET /api/health/cache and docs/RESILIENCE-REPORT.md
 */
export const RESILIENCE_REGISTRY = {
  caches: [
    { key: "resolve:discover:radar-feed:*", ttlSeconds: 90, staleSeconds: 270, description: "Discover radar feed" },
    { key: "resolve:discover:radar:v1", ttlSeconds: 30, staleSeconds: 90, description: "Discover radar snapshot" },
    { key: "resolve:discover:search:*", ttlSeconds: 45, staleSeconds: 135, description: "Discover search results" },
    { key: "resolve:profile:bootstrap:*", ttlSeconds: 30, staleSeconds: 90, description: "Profile bootstrap per user" },
    { key: "resolve:oss:opportunities", ttlSeconds: 60, staleSeconds: 180, description: "GitHub OSS opportunity scan" },
    { key: "resolve:integrations:health", ttlSeconds: 180, staleSeconds: 540, description: "Integration health probes" },
    { key: "resolve:arc:balance:*", ttlSeconds: 20, staleSeconds: 60, description: "Arc USDC balance per wallet" },
    { key: "resolve:communities:list", ttlSeconds: 20, staleSeconds: 60, description: "Communities hub list" },
    { key: "resolve:config:public", ttlSeconds: 60, staleSeconds: 180, description: "Public /api/config payload" },
    { key: "resolve:treasury:stats", ttlSeconds: 45, staleSeconds: 135, description: "Treasury stats + Arc readiness" },
    { key: "resolve:discover:builders", ttlSeconds: 120, staleSeconds: 360, description: "Unpaid value index" },
    { key: "resolve:workspace:overview", ttlSeconds: 60, staleSeconds: 180, description: "Workspace OS overview" },
    { key: "resolve:events:live", ttlSeconds: 30, staleSeconds: 90, description: "Live events timeline" },
  ],
  rateLimits: [
    { prefix: "resolve:rl:discover:*", limit: "25–80", windowSeconds: 60, routes: "Discover GETs" },
    { prefix: "resolve:rl:capital:state:*", limit: 40, windowSeconds: 60, routes: "GET /api/capital/state" },
    { prefix: "resolve:rl:github:opportunities", limit: 30, windowSeconds: 60, routes: "GET /api/github/opportunities" },
    { prefix: "resolve:rl:profile:bootstrap:*", limit: 30, windowSeconds: 60, routes: "GET /api/profile/bootstrap" },
    { prefix: "resolve:rl:stats", limit: 60, windowSeconds: 60, routes: "GET /api/stats" },
    { prefix: "resolve:rl:config", limit: 120, windowSeconds: 60, routes: "GET /api/config" },
    { prefix: "resolve:rl:treasury", limit: 60, windowSeconds: 60, routes: "GET /api/treasury" },
    { prefix: "resolve:rl:communities", limit: 80, windowSeconds: 60, routes: "GET /api/communities" },
    { prefix: "resolve:rl:workspace:overview", limit: 40, windowSeconds: 60, routes: "GET /api/workspace/overview" },
    { prefix: "resolve:rl:discover:builders", limit: 30, windowSeconds: 60, routes: "GET /api/discover/builders" },
    { prefix: "resolve:rl:events:live", limit: 60, windowSeconds: 60, routes: "GET /api/events/live" },
  ],
  safeApiRoutes: [
    "GET /api/stats",
    "GET /api/config",
    "GET /api/treasury",
    "GET /api/communities",
    "GET /api/discover/radar-feed",
    "GET /api/discover/radar",
    "GET /api/discover/search",
    "GET /api/discover/trending",
    "GET /api/discover/overview",
    "GET /api/discover/builders",
    "GET /api/github/opportunities",
    "GET /api/workspace/overview",
    "GET /api/events/live",
  ],
  fetchPolicy: {
    timeoutMs: 10_000,
    retries: 2,
    backoff: "200ms exponential",
    module: "src/lib/api/fetch-resilient.ts",
  },
  observability: {
    sentry: ["instrumentation.ts", "instrumentation-client.ts", "sentry.server.config.ts", "reportApiError", "error.tsx", "global-error.tsx"],
    note: "Vercel build queue (1 concurrent build on Hobby) does NOT affect runtime API latency — only deploy speed.",
  },
} as const;
