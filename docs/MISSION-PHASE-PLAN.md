# Mission Tab — Phase Plan to Ship

**Status:** Living roadmap after PR #341 (Blueprint loop).  
**North star:** Mission turns proof into a **named, simulatable, approvable money plan** — in one place.  
**Companion:** [MISSION-TAB-SPEC.md](./MISSION-TAB-SPEC.md) · [INFORMATION-ARCHITECTURE.md](./INFORMATION-ARCHITECTURE.md)

---

## Why RESOLVE is not “another random product”

People do not pay for dashboards. They pay when **money that was invisible becomes real**.

| What users already feel | What they cannot do today | What RESOLVE + Mission does |
|-------------------------|---------------------------|-----------------------------|
| “I merged docs / got plays / was cited” | Prove it should be paid | Connectors authorize at event time |
| “Someone should fund this” | Name who + how much + why | **Blueprint** — payees + $ + evidence |
| “I have $500 / $50k” | Allocate without insider gossip | Simulate policy → approve → Arc settle |
| “An agent read my work for free” | Charge micropay + attribute | x402 signal → **feeds the same Blueprint** |

**Mission is not chat.** Mission is the **decision layer** between “value exists” (Discover) and “money moved” (Capital).

**Agent pay in cents is not the product.** It is the **cheapest verified context** to make a decision that can move **hundreds or thousands** of dollars correctly.

```
$0.02 signal  →  $500 settlement package  →  public receipt
     ↑                    ↑                      ↑
  Obolus stops here   Inktoll stops earlier   Gaffer stops at moment
                      RESOLVE continues ───────────────►
```

---

## Value by user (why each role opens Mission)

| Role | One sentence | Mission wow (not other tabs) |
|------|--------------|------------------------------|
| **Funder** | “I have capital — who deserves it?” | Blueprint: names + $ + simulate before one cent moves |
| **Founder / operator** | “Where should our treasury go?” | Policy + allocation design scoped to one community |
| **Maintainer / creator** | “Will funding reach people like me?” | Transparent payee queue tied to program rules |
| **Agent (machine)** | “I need verified context to act” | x402 signal → structured findings → ledger path |
| **Researcher / artist** | “Citations / plays should mean money” | Citation / royalty missions → RFB rails in panel |

**Discover** answers: *where is the gap?*  
**Mission** answers: *what should I do about it — with proof?*  
**Capital** answers: *did the money actually move?*

If Mission only explains other tabs, we failed. If Mission produces a **Blueprint or receipt**, we win.

---

## Agent pay economics (cents → decisions → dollars)

| Layer | Cost | What user gets | Why it’s not “expensive” |
|-------|------|----------------|---------------------------|
| **Signal** | $0.001–$0.10 USDC | Verified intel (docs, sentiment, CVE, citation) | Less than one coffee; replaces guesswork |
| **Blueprint** | Free after signal | Named payees from ledger / program rules | Replaces hours of spreadsheet + politics |
| **Simulate** | Free | Dry-run: who clears, milestone math | Replaces costly allocation mistakes |
| **Authorize** | Pool deposit (e.g. $5+) | Arc fund + communal pool + receipt | Capital only moves after human yes |
| **Settlement** | Network fee (bps) | Public proof creators can claim | RESOLVE earns on fulfill, not on hype |

**Pay / skip** must stay honest: skip = free analysis path; pay = verified signal that **auto-fills Blueprint**. Never charge without a visible next artifact.

**Agent-to-agent (future):** funded agents hire sub-agents per signal; attribution chain rolls into Mission receipt (claim-level, like Obolus — but for **allocation decisions**, not single reads).

---

## What shipped (PR #341 baseline)

- [x] Mission OS hero — six intents (agent, fund, simulate, install, research, settle)
- [x] Blueprint panel — payees, policy chips, budget slider, pool context
- [x] Fund/simulate intents bypass chat (`detectBlueprintIntent`)
- [x] Agent → Blueprint after x402 invoke
- [x] Simulate → Authorize (fund API when signed in)
- [x] Mission receipt `/mission/report/[id]` (browser-local + server)
- [x] Discover `?scope=` handoff
- [x] Objective bar + scoped live panel

## Phase 0–7 ship status (main after #343–#344 + gap-fill)

| Phase | Status |
|-------|--------|
| 0 Demo-proof | Shipped — pool prefetch, guest simulate, authorize errors, scope handoff |
| 1 Identity | Shipped — command bar, objective phase, collapsed catalog, library badges |
| 2 Blueprint | Shipped — ledger payees, policy, checkpoint math, JSON + DAO export |
| 3 Agent lane | Shipped — pay→auto Blueprint, attribution, chains, failure+Arc→Blueprint |
| 4 Stay in Mission | Shipped — settlement preview, inline authorize API, Arc receipt |
| 5 Cooperation | Shipped — Discover fund CTA, Capital/Communities/Profile handoffs |
| 6 Trust moat | Shipped — `MissionBlueprintReceipt`, evidence, memory, diff |
| 7 Advanced | Shipped — agent budget cap, queue, RFB templates, ValueGraph |

## Cleaning checklist (before calling Mission “shipped”)

- [x] Empty state: hero + pipeline — catalogs collapsed  
- [x] Center column: artifact-first (Blueprint / report)  
- [x] Right panel: proof pipeline + pool + RFB  
- [x] Agent: pay/skip → Blueprint  
- [x] Every CTA answers “What should I do?”  
- [x] No duplicate fund buttons in Mission center  
- [x] Errors honest: sign-in / $5 min / programId  

---

## Phase 0 — Stabilize & demo-proof (ship gate)

**Goal:** One path works flawlessly in production for a live demo.

| # | Deliverable | Done when |
|---|-------------|-----------|
| 0.1 | **Fund React** tile → Blueprint in &lt;3s | Names + $ visible, no chat |
| 0.2 | **Simulate** always works guest | Dry-run banner + payee totals |
| 0.3 | **Authorize** signed-in | Pool +$5 on Arc or clear error copy |
| 0.4 | **Receipt** opens after simulate/authorize | `/mission/report/[id]` loads |
| 0.5 | **Discover → Mission** | `?scope=react` pre-scopes fund mission |
| 0.6 | Remove dead ends | No “go to Discover” as primary CTA in Mission center |

**Do not add features until 0.1–0.5 pass on production.**

---

## Phase 1 — Mission identity (feel unlike any tab)

**Goal:** User knows they are in **command deck**, not Discover/Capital.

| # | Deliverable | User value |
|---|-------------|------------|
| 1.1 | Sticky **objective + phase** strip | Always see active mission + loop phase |
| 1.2 | **Bottom action bar** only: Simulate · Policy · Export · Authorize | No fund-primary CTA in Mission |
| 1.3 | Collapse agent catalog / AI providers by default | Decision first, SKUs hidden |
| 1.4 | **Mission library** shows Blueprint/receipt status | Reopen past decisions |
| 1.5 | Copy discipline | No doctrine essays on empty state |

**Anti-patterns:** wallet hero, opportunity board, connector manager, GitHub-only branding.

---

## Phase 2 — Blueprint as signature artifact (the wow)

**Goal:** Blueprint is as legible as an Obolus receipt — but for **who gets paid**.

| # | Deliverable | User value |
|---|-------------|------------|
| 2.1 | Payees from **live ledger** first, cohort preview fallback | “Real owed rows,” not LLM fiction |
| 2.2 | **Policy chips** reshape table live (balanced / growth / sustain) | Play with philosophy before money |
| 2.3 | **Checkpoint math** inline | “If you fund $X → N authorizations clear” |
| 2.4 | **Export** Blueprint (JSON/PDF link) | Share with board / DAO |
| 2.5 | **programId** always resolved | Authorize never fails silently |

---

## Phase 3 — Agent lane (cents in, decisions out)

**Goal:** Beat Obolus/Inktoll on the **next step**, not on the toll UI.

| # | Deliverable | User value |
|---|-------------|------------|
| 3.1 | Pay / skip → **Blueprint auto** (no extra click) | Signal cost → payee table |
| 3.2 | Signal **attribution line** | “$0.02 → 10 payees → $500 package” |
| 3.3 | **Signal catalog** collapsed under “Hire intel” | Not homepage |
| 3.4 | Agent failure still shows receipt if Arc charged | Honest like production |
| 3.5 | **Sub-signals** (chained): sentiment → maintainer rank → Blueprint | Agent hires agent in cents |

---

## Phase 4 — Simulate & authorize (stay in Mission)

**Goal:** Authorize does not feel like “kicked to another tab.”

| # | Deliverable | User value |
|---|-------------|------------|
| 4.1 | **Inline authorize** — fund + prepare settlement in Mission | One thread, one outcome |
| 4.2 | **Settlement package preview** before Arc | Recipient list + batch hash |
| 4.3 | Post-authorize **Mission receipt** with Arc tx link | Decision proof + money proof |
| 4.4 | Guest: simulate + save receipt; sign-in only to authorize | Try before trust |

---

## Phase 5 — Cooperation (tabs hand off, never duplicate)

| From | To Mission | From Mission | To |
|------|------------|--------------|-----|
| Discover gap row | `?scope=community&intent=fund` | Approve plan | Capital (pre-filled) |
| Discover pool funded | Mission shows pool in panel only | Install program | Communities |
| Profile connector missing | Mission prompt once | Claim earnings | Profile |

**Rule:** Mission receives scope; it does not re-host Discover rows or Capital wallet.

---

## Phase 6 — Mission receipt & memory (trust moat)

**Goal:** Public proof of **decisions**, not just transactions.

| # | Deliverable | User value |
|---|-------------|------------|
| 6.1 | Server-persisted reports (`packageJson` on settlement) | Shareable link across devices |
| 6.2 | Receipt shows evidence links (GitHub, OpenAlex, plays) | Audit without account |
| 6.3 | **Mission memory** — “last time you funded React…” | Smarter next round |
| 6.4 | Compare receipts (diff payees / policy) | Governance transparency |

---

## Phase 7 — Advanced (post-v1, still Mission-only)

| # | Idea | Why Mission |
|---|------|-------------|
| 7.1 | Multi-mission queue (prioritize 3 objectives) | Operators juggle communities |
| 7.2 | **Agent budget** cap per mission | Machine spend guardrails |
| 7.3 | QF / citation / royalty **mission templates** | One-click RFB missions |
| 7.4 | Live panel **scoped graph** (mini value graph) | Bloomberg for this decision |
| 7.5 | DAO export — Snapshot / Tally proposal from Blueprint | Execute job, not chat |

---

## Success metrics (demo gate)

| Signal | Target |
|--------|--------|
| Time to Blueprint | &lt;5s from fund intent |
| Simulate rate | &gt;50% of Blueprint sessions |
| Authorize after simulate | &gt;30% signed-in |
| Receipt opens | &gt;1 per demo session |
| User quote | “I see who gets paid” — unprompted |

---

## One-line pitch per audience

- **Funder:** “RESOLVE shows you the check before you sign it.”  
- **Creator:** “Your work is already in the queue — Mission shows the line.”  
- **Agent:** “Two cents for proof; the settlement package is the product.”  
- **Skeptic:** “Not another AI dashboard — a decision receipt on Arc.”

---

## Gap-fill shipped (post #343–#344)

- Prisma migration for `MissionBlueprintReceipt` (production deploy)
- Capital URL prefill (`program`, `community`, `missionReport`) from Mission handoff
- Profile connector nudge in Mission when GitHub disconnected
- Agent failure + Arc charged → Blueprint panel (honest receipt path)
- Receipt compare via `/api/mission/reports/memory?compare=`

**Deferred (non-blocking):** PDF export (JSON + DAO JSON shipped); save receipt on failed fund authorize.

---

*Last updated: after merge of mission phases 0–7 + gap-fill.*
