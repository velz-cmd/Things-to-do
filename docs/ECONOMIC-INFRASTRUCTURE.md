# RESOLVE Economic Infrastructure

**Status:** Canonical spec — Codex thesis + unified product roadmap  
**Code:** `src/lib/economy/` · **API:** `GET /api/economy/infrastructure`  
**Companion:** [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md) · [POSITIONING.md](./POSITIONING.md)

---

## One sentence

> **RESOLVE is programmable economy infrastructure on Arc — anyone can earn, fund, operate, insure, repay, or build on top of value that already exists, with proof on every flow.**

Not charity. Not a destination app. **Embedded infrastructure** — Stripe/Shopify model for community economies.

---

## The real question

RESOLVE does not ask *"Who wants to donate?"*

It asks:

> **Where is value already being created, who benefits from it, and what economic flow can be attached to it?**

| Forbidden framing | Required framing |
|-------------------|------------------|
| Funders pay creators (charity) | Funders choose a **return mode** on verified value |
| RESOLVE decides who deserves pay | **Sensors authorize** at event time |
| Migrate users to RESOLVE | **Attach** beside upstream tools |
| YouTube ad model | **Programmable money flows** on Arc/Circle |

---

## Six profit engines

| Engine | For whom | Why they stay | Monetization |
|--------|----------|---------------|--------------|
| **Earn** | Creators | "You already created value — claim it" | Settlement fee on volume |
| **Fund** | Funders, DAOs, companies | Choose return mode — not blind donation | Settlement + pool fees |
| **Operate** | Founders, operators | Replace spreadsheet payout chaos | Operator SaaS |
| **Repayment** | Funders, founders | Capped payback from future inflows | Repayment pool fee |
| **Risk** | Companies | Fund dependencies before breakage | Premium reports |
| **Build** | Developers, agents | Embed obligations + settlement APIs | API + x402 fees |

### Earn Engine

Small and large creators discover money from upstream work:

- GitHub merged PRs · artist listens · citation tolls · maintainer dependency usage · moderator verified work
- Notify at ≥ $0.50 · claim at `/claim` · public receipt on Arc

### Fund Engine

Funders select a **capital mode** (see below). They never fund blindly.

### Operate Engine

Founders install programs beside Navidrome, GitHub, Open Collective. Sensors run. Strangers fund.

### Repayment Engine (high-end differentiator)

```
Funder seeds $1,000 into docs fund
  → Creators paid immediately (85%+)
  → 15% of future inflows repay funders (OC, sponsors, API, donations)
  → Cap at 1.2×–1.5× principal
  → After cap: surplus to community
```

Simulate: `POST /api/economy/repayment/simulate`

### Risk Engine (B2B)

Companies map dependency exposure → fund critical maintainers → compliance receipt.

### Build Engine

APIs: ingest authorization · create pool · settle · receipt · x402 on Arc.

---

## Seven entry doors

Onboarding: **"What do you want to do?"**

| Door | Dashboard | Habit loop |
|------|-----------|------------|
| **Earn** | `/profile` | Work → notification → claim → share |
| **Fund** | `/capital` | See queue → stake → impact updates |
| **Operate** | `/communities` | Install → sensors → deploy → fund |
| **Protect** | `/mission` (risk) | Risk map → fund → compliance renew |
| **Grow** | `/discover` | Ecosystem gap → growth fund |
| **Build** | `/stack` + API manifest | Integrate → volume → expand |
| **Settle** | Treasury | Authorize → fund → Arc tx → receipt |

---

## Five capital modes

Every program declares a funding mode at stake time:

| Mode | Funder gets | Best for |
|------|-------------|----------|
| **Impact** | Proof, reputation, 2× verified value | Small + large funders |
| **Sponsor** | Status, reports, access | Companies |
| **Repayment** | Capped 1.2–1.5× from future inflows | Patient capital |
| **Risk** | Dependency reduction, compliance | B2B procurement |
| **Growth** | Healthier ecosystem they depend on | Founders, platforms |

---

## Program templates

### Shipped (6 RFB)

| Template | Engines | Modes |
|----------|---------|-------|
| User-centric royalties | Earn, Fund, Operate | Impact, Sponsor |
| Docs bounty | Earn, Fund, Operate, Growth | Impact, Growth, Repayment |
| Security fund | Earn, Fund, Operate, Risk | Impact, Risk, Sponsor |
| Quadratic funding | Earn, Fund, Operate | Impact, Growth, Sponsor |
| Citation toll | Earn, Fund, Operate | Impact, Sponsor |
| Video royalties | Earn, Fund, Operate | Impact |

### Defined (next)

| Template | Engines | Modes |
|----------|---------|-------|
| Revenue-share pool | Fund, Repayment, Operate | Repayment |
| OSS maintainer fund | Earn, Fund, Operate, Repayment, Growth | Impact, Repayment, Growth |
| Dependency insurance | Fund, Risk, Operate | Risk, Sponsor |
| DAO contributor payroll | Earn, Operate, Fund | Impact, Sponsor |
| Founder grant pool | Fund, Operate | Impact, Growth, Sponsor |

---

## Value flow (proof of money)

```
1. Value event     — upstream records play/merge/citation
2. Authorization   — connector recognizes amount owed
3. Funding         — funder stake or operator deploy
4. Claimable       — pool releases authorized → claimable
5. Settlement      — Arc USDC memo (Circle dev wallet)
6. Receipt         — public proof (tx hash, payee, amount)
7. Repayment       — future inflows through waterfall (planned)
```

---

## Network artifacts (good addiction)

Every role gets a shareable artifact that brings them back:

| Actor | Artifact | Hook |
|-------|----------|------|
| Creator | Claim receipt | Next creator discovers RESOLVE |
| Funder | Impact page | Queue grew — fund again |
| Founder | Program ops page | Strangers funded your program |
| Company | Risk report | Quarterly renew |
| Developer | API console | Usage grows |
| DAO | Settlement archive | Next governance round |

---

## Platform revenue stack

| Stream | Model | Status |
|--------|-------|--------|
| Settlement fee | 0.5–2.5% bps (`RESOLVE_PLATFORM_FEE_BPS`) | Shipped |
| Operator SaaS | Per community / month | Planned |
| Company reports | Premium export | Planned |
| API usage | Metered + x402 | Partial |
| Program setup | Advanced templates | Planned |
| Repayment pool fee | % of waterfall | Planned |
| White-label | Branded community pages | Later |

---

## Unified phases

### Shipped (technical 0–5 + Codex 1)

Production demo **9/9** — live Arc, real sensors, real claims.

### In progress (Codex 2–4)

- Entry mode onboarding and dashboards
- Capital mode picker on fund flow
- Repayment waterfall engine + simulate API

### Advanced (7–10)

| Phase | Name | Deliverable |
|-------|------|-------------|
| **7** | Funded founders | Grant pools, retainers, stranger bootstrap |
| **8** | DAO infrastructure | Proposals, QF votes, policy → ledger |
| **9** | B2B risk product | Dependency insurance deploy + PDF |
| **10** | Network flywheel | Activity, digests, multi-community portfolio |

### DAO principles (Phase 8)

1. Governance chooses **policy and budget** — RESOLVE executes rules
2. Votes never pick individual payees — sensors authorize at event time
3. QF-weight for community; capital-weight for funding decisions only
4. Passed proposals update `rulesJson` — not retroactive authorizations

---

## Actor × engine matrix

| Actor | Engines | Small user hook | Large user hook |
|-------|---------|-----------------|-----------------|
| Creator | Earn | Micro-claims | Portfolio + receipts |
| Funder | Fund, Repayment | $5 stake, QF | Repayment cap, match pools |
| Founder | Operate, Fund | Install one community | Multi-program ops |
| Company | Risk, Fund, Repayment | — | Dependency fund + compliance |
| Developer | Build | x402 per call | Full API integration |
| DAO member | Operate, Fund | QF vote weight | Budget governance |
| Audience | — | Zero friction | — |

---

## API reference

```bash
# Full infrastructure manifest
curl https://resolve-task.vercel.app/api/economy/infrastructure

# Repayment waterfall simulation
curl -X POST https://resolve-task.vercel.app/api/economy/repayment/simulate \
  -H "Content-Type: application/json" \
  -d '{"principalUsd":1000,"futureInflowsUsd":[200,350,500,800]}'
```

---

## Build order (recommended)

1. **Entry modes** — route onboarding to seven doors  
2. **Capital modes** — fund UI + program metadata  
3. **Repayment template** — wire waterfall to ledger inflows  
4. **Risk product** — dependency insurance + company checkout  
5. **DAO proposals** — bind policy to programs  
6. **Fee stack** — SaaS + API metering + fee wallet  

---

## Shopify parallel

| Shopify | RESOLVE |
|---------|---------|
| Merchants | Community operators |
| App developers | Build engine integrators |
| Shopify revenue | Platform fees + SaaS + API |
| Customers keep shopping | Audience keeps using Navidrome/GitHub |

Everyone in the loop makes money **because value was already being created** — RESOLVE only makes it settle.
