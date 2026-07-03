# Vercel environment variables — copy into dashboard

Vercel → **things-to-do** → **Settings** → **Environment Variables**

Enable **Production**, **Preview**, and **Development** for each.

## Required (app won't work without these)

| Name | Value |
|------|-------|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (pooler URI, port **6543**) |
| `DIRECT_URL` | Supabase **direct** connection (port **5432**) — optional; used only for local `prisma migrate deploy`, not Vercel builds |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jjducnguljjddciczvuy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `NEXT_PUBLIC_APP_URL` | `https://resolve-task.vercel.app` |
| `APP_URL` | `https://resolve-task.vercel.app` |

## Arc + Circle (live settlement)

| Name | Value |
|------|-------|
| `CIRCLE_API_KEY` | From Circle Developer Console |
| `CIRCLE_ENTITY_SECRET` | From Circle Developer Console |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` |
| `ARC_CHAIN_ID` | `5042002` |
| `ARC_EXPLORER_URL` | `https://testnet.arcscan.app` |
| `ARC_AGENTIC_COMMERCE_CONTRACT` | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| `ARC_USDC_CONTRACT` | `0x3600000000000000000000000000000000000000` |
| `ARC_PROVIDER_WALLET_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |
| `ARC_CLIENT_WALLET_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |

## Playwright browser executor

| Name | Value |
|------|-------|
| `PLAYWRIGHT_ENABLED` | `true` |

## Escrow + agent

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |
| `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS` | `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f` |

## After deploy — verify (no secrets exposed)

```text
https://resolve-task.vercel.app/api/health/env
https://resolve-task.vercel.app/api/settlement/config
https://resolve-task.vercel.app/demo-portals/streamly
https://resolve-task.vercel.app/api/communities
https://resolve-task.vercel.app/discover
```

`missingRecommended` should be empty when everything is set.

## Community programs (Phases 1–3) — production merge checklist

Run **before** or **immediately after** merging community install + royalty loop to `main`.

### 1. Database migration

Apply Prisma migration `20250622230000_community_programs` on Supabase (creates `ResolveCommunityInstall` + `ResolveProgram`).

If Mission OS tables are missing, apply `20250622140000_resolve_mission_os` first (dependency for `ResolveEcosystem` FK).

**Supabase SQL editor** — paste from:

`prisma/migrations/20250622140000_resolve_mission_os/migration.sql`  
`prisma/migrations/20250622230000_community_programs/migration.sql`

Or via CLI against production:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### 2. Environment variables (Vercel)

| Name | Required | Value |
|------|----------|-------|
| `DATABASE_URL` | **Yes** | Supabase pooler URI (already required) |
| `NAVIDROME_PROGRAM_MISSION_ID` | Per bridge host | Copy from community page after **Install** (e.g. `program-<installId>-user-cen`). Bridge script on Navidrome host uses this to route scrobbles. |
| `NAVIDROME_SYNC_SECRET` | Recommended | Shared secret for `POST /api/connectors/navidrome/sync` (bridge batches) |
| `RESOLVE_PLATFORM_FEE_BPS` | Optional | `250` = 2.5% platform fee on program deploy (default if unset) |
| `RESOLVE_PLATFORM_FEE_WALLET` | Optional | Overrides the platform fee destination wallet. |

## Recommended production services

These should match `/api/health/env` and `.env.example`.

| Name | Why |
|------|-----|
| `GITHUB_TOKEN` | Higher GitHub API limits for OSS scans and repository intelligence. |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | Profile/claim GitHub connector OAuth. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY` | At least one AI provider for mission intelligence. |
| `TAVILY_API_KEY` or `SERPER_API_KEY` | Search-backed discovery and research. |
| `RESEND_API_KEY` or `BREVO_API_KEY` | Email login codes and notifications. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional cache for production stability. |
| `ALCHEMY_API_KEY` or `ALCHEMY_ARC_RPC_URL` | More reliable Arc RPC reads. |
| `NAVIDROME_SYNC_SECRET`, `JELLYFIN_SYNC_SECRET` | Protect media connector ingest endpoints. |

`NAVIDROME_PROGRAM_MISSION_ID` is **auto-generated per install** and shown on `/communities/independent-music` after install — set it on the Navidrome bridge host, not necessarily as a global Vercel var unless you have one primary program.

### 3. Happy path (production smoke)

```
Discover → Install Independent Music → copy NAVIDROME_PROGRAM_MISSION_ID
Profile → Connect Navidrome → run scripts/navidrome-bridge.ts on Navidrome host
Community page → authorizations appear → Deploy on Arc
Capital → community programs with owed amounts
Measure/Learn → rebalance panel on program card
```

Live Arc settlement requires a **funded treasury** and **real scrobble data** from the bridge.

## GitHub Actions + Vercel deploy

**One deploy per push.** Vercel’s GitHub integration deploys automatically when `main` is updated.

The workflow `.github/workflows/vercel-deploy.yml` only **verifies** that production is healthy after deploy. It does **not** call the deploy hook on every push (that caused duplicate deploys and hit Vercel’s free-tier limit of 100 deploys/day).

Manual redeploy (if Git deploy is stuck): GitHub → Actions → **Verify Vercel Production** → Run workflow → enable **trigger_deploy_hook**.

Do **not** set `VERCEL_TOKEN` in GitHub secrets for this repo — the old CLI `vercel deploy --prebuilt` path duplicated deploys and failed with `api-deployments-free-per-day`.

| Item | Value |
|------|-------|
| Production URL | `https://resolve-task.vercel.app` |
| Vercel project | `things-to-do` / `prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd` |

## Build fix (June 2025)

`vercel.json` no longer runs `prisma db push` during build. Schema is migrated on Supabase directly. This fixes 9–21 second deploy failures when `DATABASE_URL` is missing at build time.
