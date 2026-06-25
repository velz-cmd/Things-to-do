# RESOLVE Payment & Settlement Layer (Arc Native)

## Philosophy

Think like Stripe. Stripe never decides whether someone deserves payment — it only moves money.

The Payment Layer has **one responsibility**: receive the final verified allocation and execute capital safely, transparently, and efficiently.

```
GitHub Intelligence → Weight Council → Final Distribution → Payment Layer → Arc Settlement
```

**One direction only.** The payment layer never rescans GitHub, never recalculates weights, never asks an LLM anything.

## Architecture (GitHub v1)

```
Treasury
    ↓
Arc Smart Escrow Vault
    ↓
┌──────────────┼───────────────┐
Mission Pool   Bonus Pool   Emergency Pool
    └──────────────┬───────────────┘
              Contribution Engine
                    ↓
              Weight Council
                    ↓
              Settlement Planner
                    ↓
            Payment Graph Builder
                    ↓
            Circle Nano Payments
                    ↓
            Arc Batch Settlement
                    ↓
              Memo Generator
                    ↓
            Contributors Wallets
```

Nobody directly receives money. Money flows through intelligence.

## Input Contract

The Payment Engine receives **only** this object:

```json
{
  "missionId": "123",
  "treasuryAmount": "10000",
  "currency": "USDC",
  "confidence": 0.97,
  "proofHash": "0xabc...",
  "contributors": [
    { "wallet": "0x111", "weight": 0.45, "amount": "4500", "login": "alice" },
    { "wallet": "0x222", "weight": 0.30, "amount": "3000", "login": "bob" }
  ]
}
```

## Six Responsibilities

1. **Validate** — proof exists, wallets valid, sum = treasury, confidence threshold, no duplicate mission
2. **Lock Escrow** — treasury → Arc escrow, settlement becomes immutable
3. **Generate Settlement Plan** — weights → actual USDC amounts, stored forever
4. **Batch Settlement** — one batch, many recipients, Arc executes
5. **Attach Arc Memo** — every transfer carries structured context
6. **Emit Settlement Event** — immutable audit trail

## Circle Nanopayments

Pipeline agents receive micro-payouts during settlement:

| Agent | Amount |
|-------|--------|
| identity_worker | $0.05 |
| repository_worker | $0.05 |
| pr_worker | $0.10 |
| code_worker | $0.75 |
| collaboration_worker | $0.10 |
| impact_worker | $0.10 |
| reputation_worker | $0.05 |
| ecosystem_worker | $0.05 |
| reasoning_engine | $0.20 |
| confidence_engine | $0.10 |

Each nano payment includes an Arc memo with mission, agent, and proof hash.

## Arc Memo Format

```json
{
  "mission": "152",
  "repo": "open-source-ai",
  "proof": "0x83ab",
  "settlement": "Batch-12",
  "role": "Contributor",
  "contributor": "alice",
  "weight": "45"
}
```

Searchable without PostgreSQL: mission, contributor, settlement batch, proof hash.

## Capital Pools (Internal Reservation)

| Pool | Share |
|------|-------|
| Mission | 70% |
| Bonus | 20% |
| Emergency | 10% |

Reserved at escrow lock — nothing moves until settlement.

## Settlement States

```
CREATED → VALIDATING → ESCROW_LOCKED → READY → PROCESSING → SETTLED → ARCHIVED
                                                              ↓
                                                           FAILED → RETRY
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payment/create-settlement` | Validate package, preview plan |
| POST | `/api/payment/execute-batch` | Full settlement pipeline |
| POST | `/api/payment/from-github` | GitHub allocation → settlement |
| GET | `/api/payment/settlement/{id}` | Settlement detail |
| GET | `/api/payment/history` | All settlements |
| GET | `/api/payment/contributor/{wallet}` | Contributor payment history |
| POST | `/api/payment/retry` | Retry failed wallet payouts |
| GET | `/api/payment/blueprint` | Architecture metadata |

## Failure Handling

If one wallet fails:
- Mark failed wallet
- Continue remaining payments
- Retry failed wallet later via `/api/payment/retry`

No contributor loses payment because another wallet had an issue.

## Environment Variables

```
ARC_CLIENT_WALLET_ADDRESS
CIRCLE_API_KEY
CIRCLE_ENTITY_SECRET
ARC_MEMO_CONTRACT_ADDRESS
PAYMENT_AGENT_WALLET          # optional — nano payment destination
ARC_PROVIDER_WALLET_ADDRESS   # fallback for nano payments
```

## Future Ready

Today: GitHub. Tomorrow: Discord, Figma, Owncast, Mastodon, RSSHub.

The payment layer receives exactly the same `MissionSettlement` package regardless of source.
