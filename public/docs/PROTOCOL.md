# RESOLVE Open Impact Settlement Protocol

Open source. Platform-agnostic. Built for **any** contribution graph — not one community, not one hackathon hint.

## What RESOLVE is

A decentralized valuation layer that runs **before** money moves:

1. **Discover** unpaid value (Unpaid Value Index)
2. **Weight** heterogeneous contributions (Proof-of-Weight)
3. **Challenge** contested shares (Weight Dispute Layer)
4. **Settle** proportional splits on Arc (Proportional Settlement Split)

## Original primitives

| ID | Name | Does |
|----|------|------|
| UVI | Unpaid Value Index | Find high-impact contributors with $0 payouts |
| PoW | Proof-of-Weight | 7-signal score + published hash per batch |
| OCG | Open Contribution Graph | PRs, scrobbles, streams, photos, posts — one engine |
| PSS | Proportional Settlement Split | N-way split by weight, not binary markets |
| WDL | Weight Dispute Layer | Stake to pause and re-weight a payee |

## What this is not

- Not a MusicBrainz registry clone
- Not a Mastodon tipping widget
- Not a two-sided claim market
- Not a rug-risk scanner
- Not a chat-first "AI agent" dashboard

Those are different primitives. RESOLVE owns **multi-party impact valuation**.

## Gaps others leave open

- **Binary markets** cannot split a creator fund across 20 people
- **Risk scanners** do not model ongoing contributor relationships
- **Flat payrails** treat every scrobble/PR as equal
- **Payment escrows** require payees to be known upfront
- **Single-vertical winners** do not generalize across code + media + social

RESOLVE generalizes: ingest any event → score → split → settle.

## Decentralization

- MIT-licensed codebase
- Open contributor registry (any platform ID → wallet)
- Weight proof hash on every distribution batch
- Arc on-chain settlement with explorer links
- Permissionless challenge API — no operator approval
- Self-host: ingest webhooks or CSV into OCG

## Integrate

```bash
# Discover
GET /api/discover/builders
GET /api/discover/builders?repo=owner/name

# Weight a fund pool
POST /api/weight/evaluate
{ "platform": "github", "fundPoolUsd": 100, "events": [...] }

# Challenge a share
POST /api/weight/challenge
{ "payeeKey": "...", "claimedSharePercent": 42 }

# Settle
POST /api/gateway/distribute
```

Protocol metadata: `GET /api/protocol`
