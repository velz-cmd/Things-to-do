# Deploy RESOLVE (non-technical guide)

---

## Vercel rate limit (`api-deployments-free-per-day`)

Free tier allows **100 deploys per 24 hours**. If you see:

> Resource is limited — try again in 24 hours (more than 100, code: "api-deployments-free-per-day")

**What to do:**

1. **Stop** clicking Redeploy in Vercel and **do not** run `vercel deploy` or deploy hooks.
2. **Removing `VERCEL_TOKEN` from GitHub** was correct — it stopped duplicate CLI deploys.
3. **Production stays live** on the last successful deploy ([resolve-task.vercel.app](https://resolve-task.vercel.app)).
4. **Wait ~24 hours**, then merge to `main` — Vercel Git will deploy once automatically.
5. **PR red X from Vercel** is expected while rate-limited; Playwright E2E can still pass. You can merge if branch protection allows (Vercel check is optional).
6. Preview deploys on PRs are **skipped** (`vercel.json` `ignoreCommand`) so new PR pushes do not burn quota.

**One deploy per merge to `main` only.** No hooks, no CLI, no manual Redeploy unless quota has reset.

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
| `NEXT_PUBLIC_APP_URL` | `https://resolve-task.vercel.app` |
| `APP_URL` | `https://resolve-task.vercel.app` |
| `PLAYWRIGHT_ENABLED` | `true` |
| `NEXT_PUBLIC_RESOLVE_AGENT_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |
| `ARC_PROVIDER_WALLET_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` |
| `ARC_CLIENT_WALLET_ADDRESS` | `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` (or separate funded Circle client wallet) |
| `CIRCLE_API_KEY` | Circle Developer Console |
| `CIRCLE_ENTITY_SECRET` | Circle Developer Console |
| `DEPUTY_DEMO_MODE` | `false` for judge demo (real merchant step) |

Until `DATABASE_URL` is set, **every** redeploy will fail at the Prisma step — npm deprecation warnings in the log are harmless; the red P1012 line is the real blocker.

---

## Easiest fix — 4 clicks in Vercel

You are already on the right page (**Deployments**).

1. Click the blue **「Create Deployment」** button (top right of the deployments list)
2. Make sure **Branch** says `main`
3. Make sure **Environment** says **Production**
4. Click **Deploy** and wait ~2 minutes until it says **Ready**

Then open https://resolve-task.vercel.app — you should see **RESOLVE** on the left, not the old DEPUTY landing.

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
| https://resolve-task.vercel.app/tasks | 404 error | Tasks page loads |
| Left sidebar | No sidebar / DEPUTY landing | **RESOLVE** + Overview / Tasks / Vault |
| Title | DEPUTY | RESOLVE |

---

## Still stuck?

In Vercel → **Settings** → **Git** → click **Disconnect** then **Connect** your GitHub repo again. That fixes webhooks that stop firing.

Then do **Create Deployment** from `main` again.
