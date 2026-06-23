# RESOLVE — Pay only on proof

**Assign the problem. Come back when it's solved.**

Autonomous consumer advocate for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) — outcome escrow settled on Arc testnet USDC.

## Routes

| URL | Purpose |
|-----|---------|
| `/` | **Overview** — assign outcomes, snapshot, active missions |
| `/tasks` | **Tasks** — mission list |
| `/tasks/[id]` | Task detail — package timeline, agents, evidence, Arc escrow |
| `/vault` | **Vault** — smart budget, guardian, recovery |
| `/merchant` | Demo merchant refund portal (judge demo) |

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
| Frontend | Next.js 15, Tailwind, wagmi (Arc) |
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
- `GET /api/cron/tick` — scheduled retry worker

## Build checklist

See [docs/BUILD_CHECKLIST.md](./docs/BUILD_CHECKLIST.md) for Day 1–6 status and remaining work.

## License

MIT
