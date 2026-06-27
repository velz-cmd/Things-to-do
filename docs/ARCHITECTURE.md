# RESOLVE Architecture — Frozen Implementation Order

**Status:** FROZEN — do not reorder layers or add UI before the engine exists.  
**Supersedes:** ad-hoc page/navigation redesigns. Workspace is Layer 6, not the product.

---

## What RESOLVE is

RESOLVE is an **operating system** for observing value, reasoning about capital, and executing programmable payments across open ecosystems.

**Pages are temporary. Architecture is permanent.**

Ask *"What does RESOLVE know?"* — not *"What pages exist?"*

---

## The seven layers (build in order)

| Layer | Name | Question | Ship before |
|-------|------|----------|-------------|
| **1** | **The Brain** | What entities and relationships exist? | Everything else |
| **2** | **Intelligence Engine** | What should happen and why? | UI |
| **3** | **Connector Architecture** | What did sensors observe? | Value graph |
| **4** | **Value Graph** | How is the world connected? | Capital engine |
| **5** | **Capital Engine** | How does money move? | Workspace |
| **6** | **Workspace** | How do humans see the engine? | Design polish |
| **7** | **Design System** | How does it feel? | — |

**Current rule:** See [INFORMATION-ARCHITECTURE.md](./INFORMATION-ARCHITECTURE.md) for frozen tabs (6 areas). No new primary tabs until entity pages or graph ship.

---

## Layer 1 — The Brain (Core Domain)

Everything is an **entity** or a **relationship** between entities.

Core entity kinds (canonical list — extend only via ADR):

`Person` · `Identity` · `Community` · `Organization` · `Project` · `Repository` · `Package` · `Dependency` · `Creator` · `Work` · `Treasury` · `Policy` · `Connector` · `Observation` · `Authorization` · `Settlement` · `Claim` · `Wallet` · `FundingPool` · `Opportunity` · `ValueFlow` · `Agent` · `Workflow`

**Code:** `src/lib/domain/`

- `entities.ts` — `EntityType`, `EntityRef`, canonical ID conventions
- `relationships.ts` — `RelationshipType`, `Relationship`
- `observation.ts` — universal sensor output (Layer 3 emits this)
- `capabilities.ts` — what RESOLVE can do vs which APIs implement it today

---

## Layer 2 — Intelligence Engine

Reasoning combines **all** connected capabilities — not one API, not raw GPT.

Inputs: observations, graph traversals, treasury state, policies, historical funding, risk/health/velocity signals.

Outputs: evidence-backed answers to mission questions (*Where is value leaking?* · *Who is underfunded?* · *How should $100k be allocated?*).

**UI only visualizes this layer.** Intelligence owns answers.

---

## Layer 3 — Connector Architecture (Sensors)

GitHub, Navidrome, OpenAlex, MusicBrainz, ListenBrainz, Blockscout, RSSHub, PeerTube, Owncast, Mastodon, etc. are **sensors**.

**No connector-specific business logic in the platform core.**

Every sensor emits one shape: **`Observation`**.

```
GitHub      → Observation
Music       → Observation
Research    → Observation
Mastodon    → Observation
…           → Observation
```

The rest of the platform must not know whether an observation came from GitHub or MusicBrainz.

**Today:** `SettlementInputEvent` is an **authorization projection** — not the observation primitive. Migration path: `Observation` → graph materialization → `Authorization`.

---

## Layer 4 — Value Graph

Observations become **relationships**. The graph is the core data structure.

Example chain:

```
React → used_by → Next.js → used_by → Vercel → earns → treasury → funds → maintainer
```

Every recommendation, simulation, and payment policy traverses this graph.

---

## Layer 5 — Capital Engine

Money comes **after** the graph.

Treasury · policies · allocation · simulation · Circle Arc · Gateway batching · FX · claims · authorization lifecycle · retroactive funding · upstream dependency funding · community funding · multi-party policies.

---

## Layer 6 — Workspace

A **window into the engine** — not the product.

Driven by entities, relationships, observations, reasoning, and capital. Does not invent logic.

---

## Layer 7 — Design System

Last. Animations and layout communicate architecture — they do not replace it.

---

## Capabilities vs APIs

Architecture is stable when APIs swap. Capabilities are permanent.

| Capability | Implementations (today) |
|------------|-------------------------|
| Code intelligence | GitHub, GitLab (future) |
| Music attribution | MusicBrainz, ListenBrainz, Navidrome |
| Research attribution | OpenAlex, Crossref (future) |
| Blockchain settlement | Circle Arc, Blockscout |
| Identity | GitHub OAuth, wallets, ORCID (future), ENS |
| Communication | Resend |
| AI reasoning | Gemini, Llama, OpenRouter |
| Payments | Circle, Arc Gateway |
| Graph analysis | Internal graph engine (Layer 4) |
| Search | Internal semantic search (Layer 2) |

See `src/lib/domain/capabilities.ts` for machine-readable registry.

---

## What not to do

- ❌ Rename routes or navigation before Layer 1 is frozen
- ❌ Add connector-specific fields outside `Observation.raw`
- ❌ Build dashboard cards that duplicate graph logic
- ❌ Ship UI-first features without an entity/relationship home
- ❌ Treat `SettlementInputEvent` as the observation primitive (it is a ledger projection)

---

## Related docs

- [PRODUCT-VISION.md](./PRODUCT-VISION.md) — why
- [ENGINEERING-SPEC.md](./ENGINEERING-SPEC.md) — hackathon ship list
- [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md) — doctrine
- `src/lib/domain/` — Layer 1 source of truth
