# RESOLVE — Outcome Network on Arc

**Assign a financial mission. Funds release only when outcomes are verified.**

Autonomous outcome-backed payments for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) — bounties, contributor payouts, founder distribution, Arc USDC escrow.

**Live demo:** https://resolve-task.vercel.app

## Routes

| URL | Purpose |
|-----|---------|
| `/` | **Overview** — assign outcomes, snapshot, active missions |
| `/tasks` | **Tasks** — mission list |
| `/tasks/[id]` | Task detail — package timeline, agents, evidence, Arc escrow |
| `/vault` | **Vault** — smart budget, guardian, recovery |
| `/treasury` | **Treasury** — escrow totals, batch history, Arcscan |
| `/distribute` | **Distribute** — founder batch payouts to creators |
| `/contributors` | **Registry** — attribution → wallet mappings |

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000

## 90-second demo

See [DEMO.md](./DEMO.md) for the full judge script.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, Tailwind, Reown AppKit, wagmi (Arc) |
| Auth | Supabase (Google, email) + embedded wallet |
| Agents | Gemini via Vercel AI SDK + fallback plans |
| Tools | Gmail OAuth, Resend, Playwright (optional) |
| Data | Prisma + Supabase Postgres |
| Settlement | `DeputyEscrow.sol` on Arc Testnet |

## Arc contract (deployed)

`0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f` — https://testnet.arcscan.app

## API endpoints

- `POST /api/tasks` — create / execute task
- `POST /api/escrow` — sync escrow lock
- `POST /api/merchant/confirm` — merchant proof webhook
- `GET /api/artifacts/claim` — claim submission artifact (demo mode)
- `POST /api/email/test` — Resend smoke test
- `POST /api/wallet/deposit` — add funds (USDC balance)
- `GET /api/wallet/balance` — user balance + activity

## Hackathon

See **[docs/HACKATHON_WIN.md](./docs/HACKATHON_WIN.md)** for the full win playbook and judge demo paths.

## Build checklist

See [docs/BUILD_CHECKLIST.md](./docs/BUILD_CHECKLIST.md) for Day 1–6 status and remaining work.

## Deploy

Production stuck on an old build? See **[DEPLOY.md](./DEPLOY.md)** — one-click Vercel redeploy steps.

## License

MIT
