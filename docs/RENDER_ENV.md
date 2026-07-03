# Render deployment — RESOLVE / Deputy

Backup host on [Render](https://render.com) alongside Vercel production.

## Quick apply (Blueprint)

1. Merge `render.yaml` on `main` (already in repo).
2. Open the Blueprint deeplink:

   [https://dashboard.render.com/blueprint/new?repo=https://github.com/velz-cmd/Things-to-do](https://dashboard.render.com/blueprint/new?repo=https://github.com/velz-cmd/Things-to-do)

3. Connect GitHub if prompted.
4. When asked for secrets (`sync: false` keys), either:
   - **Paste from Vercel** — Vercel → things-to-do → Settings → Environment Variables → copy values, or
   - **Add from .env** — run `vercel env pull .env.production --environment=production` locally, then paste the file in Render’s “Add from .env” UI.
5. Set **`APP_URL`** and **`NEXT_PUBLIC_APP_URL`** to your Render hostname, e.g. `https://deputy.onrender.com` (not the Vercel URL).
6. Click **Apply** and wait for the first deploy.

## Service settings (manual UI)

If creating the web service without Blueprint:

| Field | Value |
|-------|-------|
| **Build** | `npm install && npx prisma db push && npm run build` |
| **Start** | `npm run start` |
| **Health check** | `/api/health/live` |
| **Region** | Oregon (free tier) |
| **Plan** | Free |

The app binds to `0.0.0.0:$PORT` (Render sets `PORT`, default `10000`).

## Required secrets (minimum)

| Name | Notes |
|------|-------|
| `DATABASE_URL` | Supabase **transaction pooler** (`pooler.supabase.com:6543`) with `?pgbouncer=true&connection_limit=1` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | WalletConnect / Reown |
| `APP_URL` | `https://<your-service>.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | Same as `APP_URL` |
| `GEMINI_API_KEY` or `GROQ_API_KEY` or `OPENROUTER_API_KEY` | At least one AI provider |
| `RESEND_API_KEY` | Email login codes |
| `CRON_SECRET` | Cron + claim token fallback |

Full list: `.env.example` and `render.yaml` (`sync: false` keys).

## Sync env from Vercel (automated)

When `RENDER_API_KEY` is available:

```bash
export RENDER_API_KEY=rnd_...
./scripts/sync-render-env.sh <service-id> deputy.onrender.com
```

List service ID: `render services -o json` or Render Dashboard → service → Settings.

## After deploy — verify

```text
https://<your-service>.onrender.com/api/health/live
https://<your-service>.onrender.com/api/health/env
https://<your-service>.onrender.com/discover
```

`missingRecommended` on `/api/health/env` should be empty.

```bash
npm run verify:discover -- https://<your-service>.onrender.com
```

## Supabase auth redirects

Add your Render URL to Supabase → Authentication → URL configuration:

- Site URL (optional secondary): `https://<your-service>.onrender.com`
- Redirect URLs: `https://<your-service>.onrender.com/**`

## GitHub OAuth (Profile → Connect GitHub)

Update GitHub OAuth app callback URL:

`https://<your-service>.onrender.com/api/auth/github/callback`

## Cron job

Blueprint includes `github-oss-scan` every 6 hours. It calls:

`POST ${RENDER_EXTERNAL_URL}/api/cron/github-oss-scan`

Requires `CRON_SECRET` on both web and cron services (set via env group + service vars).

## Cursor Cloud Agent + Render MCP

To let the agent manage Render directly:

1. Create API key: [Render → Account → API Keys](https://dashboard.render.com/u/*/settings#api-keys)
2. Add **`RENDER_API_KEY`** to Cursor → Cloud Agents → Secrets (all repos or this repo)
3. **Start a new Cloud Agent run** so the secret is injected
4. Agent can then use Render MCP (`list_services`, `create_web_service`, `update_environment_variables`)

If MCP returns `unauthorized`, the API key is not visible to the agent VM yet — use the Dashboard steps above or run `sync-render-env.sh` locally.

## Vercel vs Render

| | Vercel (primary) | Render (backup) |
|--|------------------|-----------------|
| URL | https://things-to-do-eta.vercel.app | `https://deputy.onrender.com` (after setup) |
| DB | Supabase pooler | Same Supabase pooler |
| Cold start | Serverless | Free tier spins down after 15 min idle |

Both can share the same env vars and database; only `APP_URL` / OAuth redirects differ per host.
