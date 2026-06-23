# DEPUTY — Autonomous Outcome Engine

**Assign real-world tasks. Pay only when proof of resolution is verified.**

Built for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) — outcome escrow settled on Arc testnet USDC.

## Routes

| URL | Purpose |
|-----|---------|
| `/` | Marketing landing + future outcomes |
| `/app` | 3-column operations console |
| `/app/tasks/[id]` | Task detail view |
| `/merchant` | Demo merchant refund portal |

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000 → **Open console**

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
- `POST /api/email/test` — Resend smoke test
- `GET /api/cron/tick` — scheduled retry worker

## License

MIT
