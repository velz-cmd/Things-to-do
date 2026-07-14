# RESOLVE Resilience Report

Generated for production verification of **Sentry** + **Upstash Redis**.  
Machine-readable registry: `GET /api/health/cache` · `src/lib/api/resilience-registry.ts`

---

## Build queue vs runtime (important)

**Vercel “only 1 build at a time” applies to deploys, not live traffic.**

| Concern | Affects runtime? |
|---------|------------------|
| Deployment queued on Hobby | No — existing production keeps serving |
| Redis cache + rate limits | Yes — reduces load and prevents stampedes |
| `safeApiGet` degraded JSON | Yes — UI gets 200 + empty/stale data instead of crashing |
| Sentry | Yes — captures errors without blocking requests |

A slow **deploy** does not make APIs hang. Infinite loading in the UI is caused by **uncaught client errors** or **API 500s** — this stack prevents those on hardened routes.

---

## Sentry verification

| Layer | File / hook | Env |
|-------|-------------|-----|
| Server | `sentry.server.config.ts`, `instrumentation.ts` → `onRequestError` | `SENTRY_DSN` |
| Edge | `sentry.edge.config.ts` | `SENTRY_DSN` |
| Client | `instrumentation-client.ts`, `onRouterTransitionStart` | `NEXT_PUBLIC_SENTRY_DSN` |
| API routes | `reportApiError()` → `Sentry.captureException` | either DSN |
| Error boundaries | `global-error.tsx`, `(shell)/error.tsx` | client DSN |
| Source maps | `next.config.ts` `withSentryConfig` | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |

**Verify in production:**

```bash
curl -s https://resolve-self.vercel.app/api/health/cache | jq '.sentry'
```

Expected: `configured: true`, `sourcemapsOnBuild: true` when `SENTRY_AUTH_TOKEN` is set on Vercel.

**Trigger a test error** (after deploy): open browser console on production and run `myUndefinedFunction()` — issue should appear in Sentry project `javascript-nextjs` (org `resolve-n2`) within ~1 minute.

---

## Upstash Redis verification

```bash
curl -s https://resolve-self.vercel.app/api/health/cache | jq '.redis'
```

Expected: `configured: true`, `ping.ok: true`.

When Redis is live, cache and rate limits are **shared across all Vercel serverless instances**. When unset, the app falls back to in-process memory (per-instance, resets on cold start).

---

## Cached routes (Redis + stale fallback)

| Cache key | TTL | Stale window | Route / usage |
|-----------|-----|--------------|---------------|
| `resolve:discover:radar-feed:*` | 90s | 270s | `GET /api/discover/radar-feed` |
| `resolve:discover:radar:v1` | 30s | 90s | `GET /api/discover/radar` |
| `resolve:discover:search:*` | 45s | 135s | `GET /api/discover/search` |
| `resolve:profile:bootstrap:*` | 30s | 90s | `GET /api/profile/bootstrap` |
| `resolve:oss:opportunities` | 60s | 180s | `GET /api/github/opportunities` |
| `resolve:integrations:health` | 180s | 540s | Integration probes (workspace, connectors) |
| `resolve:arc:balance:*` | 20s | 60s | Arc USDC balance reads |
| `resolve:communities:list:*` | 20s | 60s | `GET /api/communities` |
| `resolve:config:public` | 60s | 180s | `GET /api/config` |
| `resolve:treasury:stats` | 45s | 135s | `GET /api/treasury` |
| `resolve:discover:builders:*` | 120s | 360s | `GET /api/discover/builders` |
| `resolve:events:live:*` | 30s | 90s | `GET /api/events/live` |

On upstream failure, `cacheGetOrSetResilient` serves the **last good value** within the stale window before returning degraded fallback.

---

## Rate-limited routes

| Prefix | Limit / 60s | Routes |
|--------|-------------|--------|
| `resolve:rl:discover:*` | 25–80 | Discover GET family |
| `resolve:rl:capital:state:*` | 40 | `GET /api/capital/state` (per user) |
| `resolve:rl:github:opportunities` | 30 | `GET /api/github/opportunities` |
| `resolve:rl:profile:bootstrap:*` | 30 | `GET /api/profile/bootstrap` |
| `resolve:rl:stats` | 60 | `GET /api/stats` |
| `resolve:rl:config` | 120 | `GET /api/config` |
| `resolve:rl:treasury` | 60 | `GET /api/treasury` |
| `resolve:rl:communities` | 80 | `GET /api/communities` |
| `resolve:rl:workspace:overview` | 40 | `GET /api/workspace/overview` |
| `resolve:rl:discover:builders` | 30 | `GET /api/discover/builders` |
| `resolve:rl:events:live` | 60 | `GET /api/events/live` |

When limited, routes return **200 + degraded payload** (or **429** for strict routes like search).

---

## `safeApiGet` hardened routes

All return parseable JSON on failure; never throw to the client.

- `GET /api/stats`
- `GET /api/config`
- `GET /api/treasury`
- `GET /api/communities` (manual rate limit + fallback)
- `GET /api/discover/radar-feed`, `/radar`, `/search`, `/trending`, `/overview`, `/builders`
- `GET /api/github/opportunities`
- `GET /api/events/live`
- `GET /api/capital/state` (manual try/catch + rate limit)
- `GET /api/profile/bootstrap` (manual cache + rate limit)
- `GET /api/workspace/overview` (manual rate limit + cached OSS/health)

---

## External fetch policy

`src/lib/api/fetch-resilient.ts`:

- **Timeout:** 10 seconds (`AbortController`)
- **Retries:** 2 (3 attempts total)
- **Backoff:** 200ms → 400ms exponential
- **On total failure:** return `null` — callers use Redis stale cache or degraded JSON

---

## Remaining bottlenecks (not yet fully hardened)

| Route | Risk | Mitigation path |
|-------|------|-----------------|
| `GET /api/capital/discover` | Heavy scan, 60s max duration | Wrap with `safeApiGet` + Redis |
| `GET /api/workspace/os`, `/ask` | `gatherWorkspaceEvidence()` uncached | Reuse workspace evidence cache |
| `GET /api/health/live` | Uncached `buildDiscoverRadar()` | Point to cached radar-feed |
| `GET /api/mission/toolbox` | Full evidence bundle | Shared cache key with workspace |
| `POST /api/*` writes | Auth-gated; return JSON errors | Already try/catch on critical paths |
| Authenticated Arc RPC | External latency | 20s balance cache + single `WalletBalanceSync` poller |

---

## Production smoke checklist

```bash
BASE=https://resolve-self.vercel.app

# Redis + Sentry config
curl -s "$BASE/api/health/cache" | jq '{redis: .redis, sentry: .sentry}'

# Hardened routes (expect 200, never 500)
for path in /api/config /api/stats /api/discover/radar-feed /api/github/opportunities /api/treasury; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  echo "$path → $code"
done
```

All should return **200**. If upstream is down, body includes `"degraded": true` or `"stale": true`.
