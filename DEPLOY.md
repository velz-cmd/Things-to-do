# Deploy RESOLVE (non-technical guide)

---

## Build failed: Prisma `P1001` during `migrate deploy`

If deploy logs show:

```text
Error: P1001: Can't reach database server at 'db.xxx.supabase.co:5432'
```

**Cause:** Vercel build servers cannot run `prisma migrate deploy` against Supabase direct (port 5432). This is **not** a rate limit — the build exits before the app deploys.

**Fix (in repo):** Production builds use `scripts/vercel-build.sh` — `prisma generate && next build` only. Migrations are applied via Supabase; runtime code heals missing tables.

**Do not** add `prisma migrate deploy` back to `vercel.json` without a reachable migration URL.

---

## Vercel rate limit (`api-deployments-free-per-day`)

Free tier allows **100 deploys per 24 hours**. If you see:

> Resource is limited — try again in 24 hours (more than 100, code: "api-deployments-free-per-day")

**What to do:**

1. **Stop** clicking Redeploy in Vercel and **do not** run `vercel deploy` or deploy hooks.
2. **Removing `VERCEL_TOKEN` from GitHub** was correct — it stopped duplicate CLI deploys.
3. **Production stays live** on the last successful deploy ([resolve-self.vercel.app](https://resolve-self.vercel.app)).
4. **Wait ~24 hours**, then merge to `main` — Vercel Git will deploy once automatically.
5. **PR red X from Vercel** is expected while rate-limited; Playwright E2E can still pass. You can merge if branch protection allows (Vercel check is optional).
6. Preview deploys on PRs are **skipped** (`vercel.json` `ignoreCommand`) so new PR pushes do not burn quota.

**One deploy per merge to `main` only.** No hooks, no CLI, no manual Redeploy unless quota has reset.

---

## Build failed: `CRON_SECRET` whitespace (Vercel cron validation)

If deploy logs show:

```text
Error: The `CRON_SECRET` environment variable contains leading or trailing whitespace
```

**Cause:** Vercel rejects cron jobs when `CRON_SECRET` has spaces/newlines. This repo **no longer defines Vercel crons** in `vercel.json` — daily jobs run via GitHub Actions (`.github/workflows/cron-daily.yml`) instead.

**Fix (1 minute):**

1. Vercel → **things-to-do** → **Settings** → **Environment Variables**
2. Edit `CRON_SECRET` — remove any leading/trailing spaces or newlines
3. Save and redeploy `main` (or wait for the next merge)

Verify after deploy:

```text
https://resolve-self.vercel.app/api/health/deploy
https://resolve-self.vercel.app/api/health/env
```

`commit` in `/api/health/deploy` should match the latest `main` SHA (e.g. `8ad8bc8`).

---

## Build failed: missing `DATABASE_URL` (P1012)

Add in Vercel → **things-to-do** → **Environment Variables**:

- `DATABASE_URL` — Supabase → Settings → Database → Connection string (pooler URI)
- Enable **Production**, **Preview**, and **Development**
- Redeploy from `main`

Or from your machine (after `vercel login`):

```bash
./scripts/sync-vercel-env.sh
vercel deploy --prod
```

---

## Agent escrow wallet

User funds are custodied by the RESOLVE agent at:

`0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` → set as `NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS` on Vercel.

On-chain Arc escrow contract (separate): `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f`

Users must **sign in (Google or email) + connect crypto wallet** before assigning or deploying tasks.

---

Two different addresses — do not mix them up:

| Role | Address |
|------|---------|
| **Escrow contract** (where budget locks) | `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f` → `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS` |
| **RESOLVE agent oracle** (success fee only) | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` → `NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS` |

If Vercel has the **agent** address as `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS`, Rabby will show a plain “Send Token” to your treasury label and the app will fail with **Could not read TaskCreated from receipt**.

**Recommended for judges:** sign in → **Lock from balance** (no Rabby signature).

---

## Build failed: `DATABASE_URL` not found (P1012)

If deploy logs show:

```text
Error: Environment variable not found: DATABASE_URL.
error code: P1012
```

**Cause:** Runtime needs `DATABASE_URL`. The build no longer runs `prisma db push` (schema is migrated via Supabase separately).

**Fix (2 minutes):**

1. Open [Supabase](https://supabase.com/dashboard) → your project → **Settings** → **Database**
2. Copy **Connection string** → **URI** (use the **pooler** URL for serverless, port `6543`, with `?pgbouncer=true`)
3. Vercel → project **things-to-do** → **Settings** → **Environment Variables**
4. Add `DATABASE_URL` = that URI
5. Check **Production**, **Preview**, and **Development**
6. **Deployments** → **Create Deployment** → branch `main` → **Production** → Deploy

Also add these if missing (same screen):

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | [cloud.reown.com](https://cloud.reown.com) |
| `NEXT_PUBLIC_APP_URL` | `https://resolve-self.vercel.app` |
| `APP_URL` | `https://resolve-self.vercel.app` |
| `PLAYWRIGHT_ENABLED` | `true` |
| `NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |
| `CIRCLE_WALLET_SET_ID` | `52cc4ccb-0d02-5d7c-9f62-8becc86c2825` |
| `ARC_CLIENT_WALLET_ID` | `8680137f-c112-51ff-b544-e75ad58c3b9a` |
| `ARC_CLIENT_WALLET_ADDRESS` | `0xd8c4bb234e42b87109c42a928e908d73c0e6bc3c` |
| `ARC_PROVIDER_WALLET_ID` | `69885467-baa7-5175-ae57-d2af3e165133` |
| `ARC_PROVIDER_WALLET_ADDRESS` | `0xaed9af58c965b8bc3aedb126522693ffcdb6d944` |
| `RESOLVE_PLATFORM_FEE_WALLET` | `0xaed9af58c965b8bc3aedb126522693ffcdb6d944` |
| `CIRCLE_API_KEY` | Circle Developer Console |
| `CIRCLE_ENTITY_SECRET` | Circle Developer Console |
| `DEPUTY_DEMO_MODE` | `false` for judge demo (real merchant step) |

Until `DATABASE_URL` is set, **every** redeploy will fail at the Prisma step — npm deprecation warnings in the log are harmless; the red P1012 line is the real blocker.

---

## Community programs — before production merge (Phases 1–3)

After merging the community install + royalty loop branch:

1. **Run migration** `20250622230000_community_programs` on Supabase (see `prisma/migrations/`). Requires Mission OS tables from `20250622140000_resolve_mission_os` if not already applied.

2. **Set env vars** in Vercel (Production + Preview):

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Required (Supabase pooler URI) |
| `NAVIDROME_SYNC_SECRET` | Recommended — protects scrobble ingest endpoint |
| `NAVIDROME_PROGRAM_MISSION_ID` | Set on **Navidrome bridge host** after install (shown on community page) |
| `RESOLVE_PLATFORM_FEE_BPS` | Optional — `250` = 2.5% (default) |

3. **Verify** after deploy:

```text
https://resolve-self.vercel.app/api/communities
https://resolve-self.vercel.app/discover
https://resolve-self.vercel.app/communities/independent-music
```

Full checklist: [docs/VERCEL_ENV.md](./docs/VERCEL_ENV.md#community-programs-phases-13--production-merge-checklist).

Live Arc settlement still needs a funded treasury and real scrobble data from `scripts/navidrome-bridge.ts`.

---

## Easiest fix — 4 clicks in Vercel

You are already on the right page (**Deployments**).

1. Click the blue **「Create Deployment」** button (top right of the deployments list)
2. Make sure **Branch** says `main`
3. Make sure **Environment** says **Production**
4. Click **Deploy** and wait ~2 minutes until it says **Ready**

Then open https://resolve-self.vercel.app — you should see **RESOLVE** on the left, not the old DEPUTY landing.

**Do not** click Redeploy on the old row (`4a7829a`) — that only rebuilds the old version.

---

## Even easier next time — Deploy Hook (paste URL to Cursor)

So the AI can deploy for you with one command:

1. Vercel → project **things-to-do** → **Settings** → **Git** → scroll to **Deploy Hooks**
2. Click **Create Hook**
   - Name: `cursor-deploy`
   - Branch: `main`
3. Copy the hook URL (looks like `https://api.vercel.com/v1/integrations/deploy/...`)
4. Paste that URL in chat and say **「deploy now」**

The agent can trigger production deploys without you clicking anything.

---

## Why the AI cannot deploy Vercel for you yet

- **Vercel is not connected** to this Cursor agent (MCP shows error)
- **GitHub Actions** needs a Vercel token you have not added yet
- Pushes to GitHub **stopped triggering** Vercel after commit `4a7829a`

### Optional: connect Vercel to Cursor (one-time)

In **Cursor** → **Settings** → **MCP** → **Vercel** → **Authenticate**

After that, ask the agent to deploy again.

---

## How to know it worked

| Check | Old (wrong) | New (correct) |
|-------|-------------|---------------|
| https://resolve-self.vercel.app/tasks | 404 error | Tasks page loads |
| Left sidebar | No sidebar / DEPUTY landing | **RESOLVE** + Overview / Tasks / Vault |
| Title | DEPUTY | RESOLVE |

---

## Still stuck?

In Vercel → **Settings** → **Git** → click **Disconnect** then **Connect** your GitHub repo again. That fixes webhooks that stop firing.

Then do **Create Deployment** from `main` again.
