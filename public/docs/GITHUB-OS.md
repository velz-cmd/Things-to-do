# RESOLVE GitHub OS — Capital Allocation Operating System

Phase 1 blueprint. GitHub only. No Discord, Figma, or multi-community adapters yet.

## Thesis

**Money is easy. Knowing where money should go is hard.**

Billion-dollar companies (Stripe, Cloudflare, Bloomberg, Palantir) win by becoming the **source of truth** — not by connecting the most APIs.

RESOLVE v1 goal: become the source of truth for **value attribution** on GitHub.

## Architecture (pipeline, not democracy)

```
GitHub APIs
    ↓
Normalizer (common language)
    ↓
Evidence Bus
    ↓
Workers (×7, parallel, independent)
    ↓
Reasoning Engine (reads bus ONCE)
    ↓
Confidence Engine (trust tiers)
    ↓
Founder Intent
    ↓
Allocation Engine
    ↓
Arc Settlement
    ↓
Blockscout verification (post-settlement only)
    ↓
Proof Graph
```

### Anti-pattern we avoid

```
Agent A ──┐
Agent B ──┼── fight ── random score
Agent C ──┘
```

### Pattern we use (Cursor-style)

```
Worker A → Evidence Bus
Worker B → Evidence Bus     → Reasoning Engine → Decision
Worker C → Evidence Bus
```

Workers **enrich**. They never **decide**. They never **read each other**.

## The 10 layers

| # | Layer | AI? | Job |
|---|--------|-----|-----|
| 1 | GitHub Adapter | No | PRs, reviews, commits, issues — raw facts |
| 2 | Normalizer | No | Artifacts, interactions, outcomes — common language |
| 3 | Evidence Bus | No | Immutable evidence locker |
| 4 | Workers (×7) | Partial | Enrich evidence per domain |
| 5 | Reasoning Engine | Yes | Single synthesis — value weight |
| 6 | Confidence Engine | No | Trust tiers + settlement gates |
| 7 | Founder Intent | No | Infra/docs/community priorities |
| 8 | Allocation Engine | No | Proportional USDC split |
| 9 | Arc Settlement | No | Escrow → batch payout |
| 10 | Proof Graph | No | Hashes for audit |

## The 7 workers

| Worker | Reads | Adds | Never |
|--------|-------|------|-------|
| Identity | GitHub profile | Account age, PR history, diversity | Rejects users |
| Repository | Repo stats | Health, funding gap, maintainers | Scores people |
| PR | Merge metadata | Contribution facts | Uses AI |
| Code | Diff (OpenRouter) | Complexity, change type, tests | Decides payout |
| Collaboration | Review threads | Discussion depth, maintainer engagement | Talks to Code worker |
| Impact | File paths, stars | Core modules, security, dependents | Uses Blockscout |
| Reputation | Prior PRs in repo | Historical context | Punishes new users |

## Sybil resistance (confidence, not binary)

We do **not** use:

- Commits per day (Cursor users would false-positive)
- "AI-generated code" detection
- Lines of code thresholds
- Binary bot/human labels

We use **trust tiers**:

| Tier | Meaning |
|------|---------|
| Verified | Auto-settle eligible |
| Likely verified | Normal settlement |
| Unknown | Founder review — **not rejected** |
| Likely sybil | Hold from auto-settle |
| Rejected | Excluded — incoherent evidence only |

Signals are **weak alone, strong together** (Stripe/Cloudflare model):

- Identity trust (GitHub age, history, diversity)
- Contribution trust (meaningful diff, tests, architecture)
- Review trust (maintainer engagement)
- Repository trust (legitimate project health)
- Historical trust (prior accepted work)
- Coherence (does complexity match collaboration?)

## APIs (lean stack)

### Required

- **GitHub REST** — files, issues, contributors
- **GitHub GraphQL** — merged PRs + reviews in one query
- **OpenRouter** — Code Worker only (one model per task)

### Post-settlement only

- **Blockscout / Arcscan** — verify tx, never score

### Optional

- **Libraries.io** — downstream dependents (Impact Worker)
- **OpenAlex** — research repos with citations only

### Deferred

Discord, Figma, X, Mastodon, Owncast, Hugging Face hosting

## Settlement gates

| Gate | Condition |
|------|-----------|
| Auto-settle | Confidence ≥ 0.72, ≤ 1 coherence flag |
| Founder review | Confidence 0.55–0.72 or tier = unknown |
| Hold | Low confidence, not excluded |
| Excluded | Incoherent evidence or unmerged PR |

## Proof Graph

Every payout stores:

```
evidence_hash → reasoning_hash → verdict_hash → settlement_hash → proof_root
```

Anyone can audit why Alice got $5,800.

## Path to $2B moat

| Year | Asset |
|------|-------|
| 1 | Evidence data |
| 2 | Attribution graph |
| 3 | Portable reputation |
| 5 | Capital allocation intelligence |

## Endpoints

```
GET  /api/github/blueprint
GET  /api/github/opportunities
POST /api/github/analyze
POST /api/github/allocate
GET  /api/github/proof?txHash=0x...
```

UI: `/blueprint` · `/radar` · `/weight`
