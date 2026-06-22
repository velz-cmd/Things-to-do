# DEPUTY — Autonomous Outcome Engine

**Assign real-world tasks. Pay only when proof of resolution is verified.**

Built for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) — outcome escrow settled on Arc testnet USDC.

## One line

> You don't ask AI for answers — you assign it to complete real-world tasks until you get proof it is done.

## The rule

> Money moves when proof of resolution is verified — not per token, not per call, not per step.

## 90-second demo script

1. Open the operations console — show financial dashboard (recovered, cost, net gain).
2. Assign: **"Recover my $43 refund from SkyDemo Airlines"**
3. **Lock demo escrow** ($1 USDC budget, $0.20 success fee)
4. Click **Deploy deputy agents** — watch timeline:
   - Planner → Evidence (Gmail booking found) → Executor (portal + email) → Retry → Verification
5. Open **Merchant portal** (`/merchant`) — approve refund proof
6. Show **Proof engine: VERIFIED** + **Net gain: +$42.73** + settlement tx link

**Winning phrase:** *"DEPUTY is not pay-per-token. It is pay-per-resolution."*

## MVP demo flow

1. User assigns outcome from template
2. User locks Arc escrow (demo or on-chain if contract deployed)
3. Deputy agents execute via controlled tool layer (Gmail, browser, Resend mocks)
4. Merchant confirms refund at `/merchant` or auto-webhook
5. Proof engine verifies → Arc escrow releases success fee
6. Dashboard updates: **Recovered $43 · Cost $0.08 · Net +$42.72**

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, Tailwind, wagmi (Arc wallet) |
| Outcome engine | Task state machine, agent orchestrator, proof verifier |
| Tool layer | Gmail, Resend, Playwright, Plaid (mock + env hooks) |
| Data | Prisma + SQLite |
| Settlement | `DeputyEscrow.sol` on Arc Testnet |
| Demo merchant | `/merchant` + `/api/merchant/confirm` |

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Arc integration

- Escrow contract: [`contracts/src/DeputyEscrow.sol`](contracts/src/DeputyEscrow.sol)
- Chain: Arc Testnet (5042002) — USDC native gas
- Faucet: https://faucet.circle.com

Deploy contract:

```bash
export DEPUTY_ORACLE_PRIVATE_KEY=0x...
./scripts/deploy-escrow.sh
# Set NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS in .env
```

## Architecture

```
User task → Planner → State machine → Tool executors → Retry/Escalation
                                              ↓
                                    Proof verification engine
                                              ↓
                                    Arc escrow settlement
```

## Lepton criteria

| Criteria | How DEPUTY scores |
|----------|-------------------|
| **Agentic (30%)** | Multi-agent pipeline with persistent task state |
| **Traction (30%)** | $ recovered, tasks completed, micro-payment log |
| **Circle/Arc (20%)** | Escrow contract, testnet USDC, proof-gated release |
| **Innovation (20%)** | Pay-per-resolution — new economic rule |

## Doctrine

See [`src/lib/deputy/types.ts`](src/lib/deputy/types.ts) — outcome-first, proof-or-nothing, escalate-before-damage.

## License

MIT
