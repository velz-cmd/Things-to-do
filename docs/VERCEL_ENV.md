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
| `NEXT_PUBLIC_APP_URL` | `https://things-to-do-eta.vercel.app` |
| `APP_URL` | `https://things-to-do-eta.vercel.app` |
| `OAUTH_REDIRECT_ORIGIN` | `https://things-to-do-eta.vercel.app` |

`OAUTH_REDIRECT_ORIGIN`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, and every external OAuth app callback must use the same canonical host. For GitHub, set the OAuth app callback exactly to `https://things-to-do-eta.vercel.app/api/connectors/github/callback`.

## Arc + Circle (live settlement)

**Operators only** — set once in Vercel. End users never configure Vercel; they sign in, get a RESOLVE wallet automatically, and fund/settle on **Arc testnet** (visible on [Arcscan](https://testnet.arcscan.app)).

| Name | Value (RESOLVE production example) |
|------|-------------------------------------|
| `CIRCLE_API_KEY` | Full Circle key: `TEST_API_KEY:…:…` (entire string) |
| `CIRCLE_ENTITY_SECRET` | 64-char **entity secret** from Circle → Developer Wallets (not `TEST_CLIENT_KEY` unless Circle labels it entity secret) |
| `CIRCLE_WALLET_SET_ID` | Wallet set UUID where user wallets are created, e.g. `52cc4ccb-0d02-5d7c-9f62-8becc86c2825` |
| `ARC_CLIENT_WALLET_ADDRESS` | **Settlement treasury** — pool funds land here, e.g. `0xd8c4bb234e42b87109c42a928e908d73c0e6bc3c` |
| `ARC_CLIENT_WALLET_ID` | Circle wallet UUID for treasury (optional if address is in `CIRCLE_WALLET_SET_ID` — app resolves from Circle) |
| `ARC_PROVIDER_WALLET_ADDRESS` | **Agent / platform fee** wallet, e.g. `0xaed9af58c965b8bc3aedb126522693ffcdb6d944` |
| `ARC_PROVIDER_WALLET_ID` | Circle wallet UUID for provider (optional — resolved from address when omitted) |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` (Alchemy preferred when `ALCHEMY_API_KEY` is set) |
| `ARC_CHAIN_ID` | `5042002` |
| `ARC_EXPLORER_URL` | `https://testnet.arcscan.app` |
| `ARC_AGENTIC_COMMERCE_CONTRACT` | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| `ARC_USDC_CONTRACT` | `0x3600000000000000000000000000000000000000` |

**Do not use** doc placeholders `0xDD81E79E…` or a JWT in `CIRCLE_WALLET_SET_ID`. Scope: **Production** + **Preview** (or All Environments).

**Fund treasury** after deploy: [faucet.circle.com](https://faucet.circle.com) → Arc Testnet → `ARC_CLIENT_WALLET_ADDRESS`.

### What users do (no Vercel)

| User action | On-chain |
|-------------|----------|
| Sign in | RESOLVE creates a Circle wallet in `CIRCLE_WALLET_SET_ID` |
| Fulfill pool (Capital balance) | User RESOLVE wallet → `ARC_CLIENT_WALLET_ADDRESS` (real Arc tx, `txHash` on receipt) |
| Fulfill pool (connected MetaMask) | User signs → treasury → verified on Arcscan |
| View proof | `/receipt/{id}` links to Arcscan when `txHash` exists |

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
https://things-to-do-eta.vercel.app/api/health/env
https://things-to-do-eta.vercel.app/api/settlement/config
https://things-to-do-eta.vercel.app/demo-portals/streamly
https://things-to-do-eta.vercel.app/api/communities
https://things-to-do-eta.vercel.app/discover
```

`missingRecommended` should be empty when everything is set. For Arc, also confirm `ARC_CLIENT_WALLET_ID` and `ARC_PROVIDER_WALLET_ID` are **true** (not only addresses).

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
| `ALCHEMY_API_KEY` or `ALCHEMY_ARC_RPC_URL` | **Recommended for Capital balance.** Set `ALCHEMY_API_KEY` to your Arc testnet key only (server builds `https://arc-testnet.g.alchemy.com/v2/<key>`). Or set full `ALCHEMY_ARC_RPC_URL`. Never `NEXT_PUBLIC_`. After deploy: `GET /api/health/arc-rpc` → `alchemyConfigured: true`, `blockNumber` > 0. Optional server proxy: `POST /api/rpc` with `x-chain: arc-testnet`. |
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

**One deploy per push to `main`.** Vercel Hobby allows **one concurrent build** — preview/cursor branch builds were blocking production.

### Root causes (fixed in `vercel.json`)

| Problem | Cause | Fix |
|---------|--------|-----|
| Production **Queued** forever | Preview build on `cursor/*` hogging the single build slot | `git.deploymentEnabled`: only `main: true`, `cursor/**` + `*` false |
| Many **Redeploy** rows | Manual Redeploy duplicates queue entries | Push to `main` only; cancel extras in dashboard |
| Preview **Error** on old PRs | TypeScript errors on merged feature branches (fixed in #324+) | Ignore — previews disabled; production uses `main` |
| **Building** 15m+ then stuck | `next build` + Sentry behind a preview in queue | Previews no longer start; `autoJobCancelation: true` |

`scripts/vercel-should-build.sh` skips any non-`main` / non-production build (backup to `deploymentEnabled`).

**Do not** click **Redeploy** repeatedly in Vercel — each click queues another Production build.

**Queued deployments:** Cancel all duplicate Queued/Building rows; keep only the latest `main` push.

The workflow `.github/workflows/vercel-deploy.yml` only **verifies** production health after deploy. It does **not** trigger deploy hooks (removed — they duplicated queue).

Do **not** set `VERCEL_TOKEN` in GitHub secrets for this repo — the old CLI `vercel deploy --prebuilt` path duplicated deploys and failed with `api-deployments-free-per-day`.

| Item | Value |
|------|-------|
| Production URL | `https://things-to-do-eta.vercel.app` |
| Vercel project | `things-to-do` / `prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd` |

## Build fix (June 2025)

`vercel.json` no longer runs `prisma db push` during build. Schema is migrated on Supabase directly. This fixes 9–21 second deploy failures when `DATABASE_URL` is missing at build time.
