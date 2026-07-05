# Performance & caching

RESOLVE uses **real data only** — caching stores live API/DB results briefly so tabs load faster globally. Nothing is faked or stubbed.

## Upstash Redis (free tier)

Shared cache across Vercel serverless instances. Without Redis, the app falls back to in-process memory (still fast per instance, but not shared).

### Vercel env vars

| Variable | Example |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | `https://complete-escargot-42140.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash → Redis → REST → TOKEN |

Set for **Production** + **Preview**, then **Redeploy**.

### Verify

- `GET /api/health/cache` → `ping.ok: true`
- `GET /api/health/env` → `REDIS_CACHE: true`

### What is cached (TTL)

| Key | TTL | Data |
|-----|-----|------|
| `resolve:discover:radar-feed:*` | 45s | Full Discover tab feed (18s build cap per request) |
| `resolve:oss:opportunities` | 60s | GitHub OSS scan results |
| `resolve:arc:balance:*` | 20s | Per-address Arc USDC on-chain read |

## Client-side (already in app)

- **TanStack Query** — tab switches reuse cached fetches (`staleTime` 30–90s)
- **Parallel fetches** — profile bootstrap uses `Promise.all`
- **Discover timeouts** — server caps each feed part at 3–10s; client aborts at 18s with degraded fallback (never infinite skeleton)
- **HTTP Cache-Control** — Discover/profile routes use `stale-while-revalidate`

## Edge health routes

`/api/health/cache` and `/api/health/deploy` run on Vercel Edge for fast global responses (~100ms).

## Lazy-loaded UI

Heavy Discover bubblemap and Settle/Weight impact charts load via `next/dynamic` after first paint.
