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
| `resolve:discover:radar-feed:*` | 30s | Full Discover tab feed |
| `resolve:oss:opportunities` | 60s | GitHub OSS scan results |
| `resolve:integrations:health` | 180s | External API health pings |

## Client-side (already in app)

- **TanStack Query** — tab switches reuse cached fetches (`staleTime` 30–90s)
- **Parallel fetches** — profile bootstrap uses `Promise.all`
- **HTTP Cache-Control** — Discover/profile routes use `stale-while-revalidate`

## Database

Prisma schema already indexes hot columns (`userId`, `communitySlug`, `status`, etc.). Add more indexes in Supabase only when a specific query is slow.
