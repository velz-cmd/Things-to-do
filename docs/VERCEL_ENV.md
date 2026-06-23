# Vercel environment variables — copy into dashboard

Vercel → **things-to-do** → **Settings** → **Environment Variables**

Enable **Production**, **Preview**, and **Development** for each.

## Required (app won't work without these)

| Name | Value |
|------|-------|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (pooler URI) |
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
```

`missingRecommended` should be empty when everything is set.

## GitHub Actions deploy secrets

The cloud agent cannot write GitHub repository secrets (API 403). To enable the optional CLI deploy path, run locally after `gh auth login` and `npx vercel login`:

```bash
./scripts/setup-github-vercel-secrets.sh
```

This sets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` from your local Vercel CLI session.

**Without those secrets**, pushes to `main` still deploy via:
1. Vercel GitHub integration (already connected to `velz-cmd/Things-to-do`)
2. GitHub Actions deploy hook (`VERCEL_DEPLOY_HOOK_URL` in workflow)

| Secret | Value source |
|--------|----------------|
| `VERCEL_ORG_ID` | `team_apDtKK364C3BW1LjG3M93rhI` |
| `VERCEL_PROJECT_ID` | `prj_bCorqG2sezHdXiRmedRRwV0Q7Rhd` |
| `VERCEL_TOKEN` | `~/.local/share/com.vercel.cli/auth.json` or [vercel.com/account/tokens](https://vercel.com/account/tokens) |

## Build fix (June 2025)

`vercel.json` no longer runs `prisma db push` during build. Schema is migrated on Supabase directly. This fixes 9–21 second deploy failures when `DATABASE_URL` is missing at build time.
