# AGENTS.md

## Cursor Cloud specific instructions

RESOLVE (package name `deputy`) is a single Next.js 15 / React 19 app (App Router) backed by
Prisma + PostgreSQL. Contracts live in `contracts/` (Foundry) and are independent of the web app.

### Services
- **Next.js web app** — the product. Dev: `npm run dev` (binds `0.0.0.0:3000`). Lint: `npm run lint`.
  Build: `npm run build`. See `package.json` scripts for the rest (Playwright e2e, tsx scripts).
- **PostgreSQL** — required. The startup update script provisions a local cluster and a `resolve`
  database, and `.env` points `DATABASE_URL` at `postgresql://postgres:postgres@127.0.0.1:5432/resolve`.
  If Postgres is not running, start it with `sudo pg_ctlcluster 16 main start`.

### Local env / demo mode (non-obvious)
- `.env` is gitignored and is created fresh by the update script if missing. It sets
  `DEPUTY_DEMO_MODE=true`, which lets the product run **without** external services
  (Supabase auth, AI providers, Circle/Arc, Resend). Everything degrades gracefully.
- After changing the Prisma schema, run `npx prisma db push` (dev) to sync the local DB.
- The wallet SDK (Reown/wagmi) logs harmless `api.web3modal.org ... 403` fetch errors when
  `NEXT_PUBLIC_REOWN_PROJECT_ID` is unset — these are non-fatal and do not affect the server.

### Authentication is Supabase-gated (important)
- All **authenticated write flows** (create task/mission, settlement, distribute, most
  `/api/*` POSTs) call `requireReadyUser()` → Supabase. With no Supabase env they return
  `401 "Sign in with Google or email to continue"`. "Continue as guest" is client-side only
  (localStorage) and does **not** create a server session, so it cannot exercise write APIs.
- To test authenticated end-to-end flows locally you must supply real Supabase credentials
  (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) in `.env`.
- Unauthenticated core paths that DO work locally and are good smoke tests: `GET /api/config`,
  `GET /api/tasks`, `GET /api/templates`, `GET /api/stats`, `GET /api/discover/trending`,
  `GET /api/discover/search?q=...`, `GET /api/github/opportunities`, and the Discover UI
  ("Find opportunities" → Opportunity board).

### Cron / background jobs (non-obvious)
- `GET|POST /api/cron/tick` runs the core scheduler + snapshot refresh and **writes to the DB**
  (e.g. `CommunityVitalsSnapshot`, `GithubOssScan`). In dev with no `CRON_SECRET` set it is
  allowed **unauthenticated** (see `authorizeCronRequest`), so it is a reliable way to exercise
  the full API→Prisma→Postgres write path and populate Discover data without signing in.

### Contracts (`contracts/`)
- Foundry toolchain (`forge build` / `forge test`); not needed to run the web app. Requires a
  separate Foundry install (not part of the web-app update script).
