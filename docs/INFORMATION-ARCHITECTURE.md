# RESOLVE Information Architecture — FROZEN

**Status:** FROZEN — do not add tabs, pages, or connector dashboards without updating this doc.  
**Companion:** [ARCHITECTURE.md](./ARCHITECTURE.md) (engine layers), [PRODUCT-VISION.md](./PRODUCT-VISION.md) (why)

---

## First principle

**What should become effortless because RESOLVE exists?** Capital allocation — across the open internet.

Users don't wake up saying *"I want to use RESOLVE."* They wake up with questions:

- I have $100k — who deserves it?
- Where is our ecosystem breaking?
- Am I getting paid fairly?
- Who depends on me?
- Where should grants go?

**The primitive is VALUE.** Not GitHub. Not Navidrome. Not payments. Not dashboards.

Everything enters as **observations** → **relationships** → **reasoning** → **capital** → **verification**.

Connectors are invisible. Ecosystems are equal. Users think in **outcomes**; the backend thinks in **events**.

**Canonical positioning:** [POSITIONING.md](./POSITIONING.md)

---

## How many tabs? **Six. No more. No less.**

| # | Tab | Route | One question it answers |
|---|-----|-------|-------------------------|
| 1 | **Home** | `/` | What is RESOLVE? |
| 2 | **Discover** | `/discover` | Where does value already exist? |
| 3 | **Mission** | `/mission` | What should I do? |
| 4 | **Capital** | `/capital` | Where should money move? |
| 5 | **Network** | `/network` | What is happening globally? |
| 6 | **Profile** | `/profile` | Who am I in this ecosystem? |

**Settings** (`/settings`) is **not** a primary tab. Boring infra: theme, security, API keys, billing, webhooks, experimental flags.

**Entity pages** (`/e/[entityId]`) are **not** tabs. Deep dives: React, a paper, an artist, a university — same layout, different data.

---

## What is NOT a tab (ever)

| Kill | Merge into |
|------|------------|
| Workspace (old) | Mission |
| Activity (standalone) | Network |
| Fund page (standalone tab) | Mission action → Capital |
| Connectors page | Profile + Settings (admin) |
| GitHub / Navidrome / Music dashboards | Entity pages |
| Observe / Understand / Decide / Execute / Verify as top nav | Mission + Discover + Capital + Network |

**Hidden infrastructure** (Settings or admin only): connector manager, jobs, agents, model config, API health, logs, queues, webhooks, bridge sync.

---

## 1. HOME (`/`)

**Purpose:** Understand RESOLVE in 30 seconds. Marketing only.

**Never:** forms, dashboards, connector cards, fake stats.

| Section | Content |
|---------|---------|
| Hero | Animated value graph — nodes, dependencies, money flowing (not particles) |
| Headline | *RESOLVE tells you where money should go across the open internet — and moves it there once you approve.* |
| CTA | **Open Mission** · Watch Live Network |
| Problems | Broken flows: stars ≠ pay, spreadsheets, invisible contributors, 30 tools |
| Solution | Observe → Reason → Authorize → Settle → Claim |
| Industries | Code, music, research, publishing, photos, video, design, communities, DAOs, AI, education, datasets… |
| Live network | Real events only (or honest empty state) |
| Social proof | DAO, foundation, university, startup, protocol, OSS org |
| How it works | 5-step pipeline animation |
| Footer | Developers, API, docs, community, roadmap, GitHub |

---

## 2. DISCOVER (`/discover`)

**Question:** Where does value already exist?

**For:** discovering — not chatting, not paying, not treasury.

| Section | Content |
|---------|---------|
| Global search | Communities, projects, people, works, orgs |
| Discover communities | Trending, at-risk, underfunded |
| Funding gaps | Critical maintainers, dependency risk |
| Hidden contributors | Unpaid but high-impact |
| Browse by domain | Code, music, research, video, design, datasets (not connector names) |
| Enter mission | Any result → scopes Mission |

Think: search + explore without looking like GitHub Explore or a crypto dashboard.

---

## 3. MISSION (`/mission`) — the operating system

**Question:** What should I do?

**Replaces:** old Workspace, Command, Understand tab.

Everything revolves around **one mission** at a time (*Fund React*, *Distribute $500k*, *Find value leaks*).

### Layout (three columns)

```
┌─────────────┬──────────────────────────┬─────────────┐
│  Sidebar    │  Main (largest)          │  Live panel │
│  (tools)    │  AI reasoning            │  (Bloomberg)│
└─────────────┴──────────────────────────┴─────────────┘
```

### Sidebar — workspace **tools**, not product tabs

| Tool | Purpose |
|------|---------|
| **Command** | AI reasoning (default) |
| **Context** | Mission scope, entity summary |
| **Network** | Mini graph for this mission |
| **Entities** | People, repos, works in scope |
| **Capital** | Treasury slice for this mission |
| **Policies** | Allocation rules for this mission |
| **History** | Observations + payments in scope |

### Center — economic reasoning engine (not chatbot)

User asks: *Where should I allocate $500k?*

AI returns: graph, evidence, communities, dependencies, risk, recommendations.

Actions: **Approve** · **Inspect** · **Simulate** · **Modify** · **Export**

### Right panel — always alive

Live events scoped to mission: community detected, funding gap, citation, play, settlement finished.

### Bottom — quick actions (small, not card stacks)

Fund · Simulate · Policy · Export evidence

### Secondary routes (no top-nav tab)

| Route | Purpose |
|-------|---------|
| `/mission/fund` | Full fund-repo flow (action from Mission) |
| `/mission?panel=policies` | Policies panel |

---

## 4. CAPITAL (`/capital`)

**Question:** Where should money move?

Real money. Stripe simplicity. **Four sections only:**

| Section | Content |
|---------|---------|
| **Treasury** | Balance, obligations, available |
| **Pending** | Authorizations waiting for funding |
| **Claims** | What people can collect now |
| **History** | Ledger, settlements, batches |

Advanced (same page, below fold or sub-nav): policies, simulation, FX, Arc batching — not separate tabs.

**Replaces:** old Payments, Fund-as-tab, Treasury page.

---

## 5. NETWORK (`/network`)

**Question:** What is happening globally?

Everything **live**. No duplicate Mission dashboards.

| Section | Content |
|---------|---------|
| **Activity feed** | Timeline of value events |
| **Global value graph** | The product's visual identity (when built) |
| **Relationship graph** | Dependencies, citations, usage |
| **Health signals** | Communities at risk, connector status (internal label only) |
| **Top changes** | What's moving today |

**Replaces:** old Activity, Connectors-as-page, Verify tab.

---

## 6. PROFILE (`/profile`)

**Question:** Who am I in this ecosystem?

Identity OS — not GitHub-first.

| Section | Content |
|---------|---------|
| Overview | Unified identity summary |
| Wallets | Arc, claim destination |
| Identities | GitHub, MusicBrainz, ORCID, ENS… |
| Communities & orgs | Memberships, roles |
| Payout methods | Currency, FX prefs |
| Connected ecosystems | Sensors (connectors invisible to user) |
| Notifications | Settlement, claim alerts |
| Reputation & trust | When available |
| Developer | API keys (or link to Settings) |

---

## SETTINGS (`/settings`) — not in primary nav

Theme · security · API · billing · webhooks · privacy · experimental.

---

## Entity pages (`/e/[id]`)

**Biggest opportunity.** One layout for everything:

| Block | Examples |
|-------|----------|
| Overview | React, Taylor Swift track, OpenAlex paper, university |
| Value & funding | Current flows, gaps |
| Dependencies / relationships | Graph slice |
| People | Maintainers, creators, contributors |
| Organizations using it | Downstream |
| Treasury & history | Payments, authorizations |
| Risks & recommendations | AI + evidence |
| Timeline | Observations → settlements |

Click any node in the Global Value Graph → Entity page.

---

## Universal command bar (⌘K / Ctrl+K)

Available everywhere. Users never memorize where features live.

Examples:

- `Fund React with 50,000 USDC`
- `Find underpaid maintainers`
- `Show my unpaid music plays`
- `Analyze the Kubernetes ecosystem`
- `Show where value leaked this week`

Tabs = structure. Command bar = speed.

---

## Five verbs (every screen must answer one)

| Verb | Question | Primary home |
|------|----------|--------------|
| **Observe** | Where does value exist? | Discover |
| **Understand** | What matters? | Mission |
| **Decide** | Where should capital go? | Mission + Capital |
| **Execute** | Move money | Capital |
| **Verify** | What changed? | Network |

---

## Workflows (design pages from these, not the reverse)

| Persona | Workflow |
|---------|----------|
| **Creator** | Discovered earnings → inspect why → connect wallet → claim |
| **Founder** | $100k treasury → understand impact → simulate → approve → settle |
| **DAO** | Retroactive round → review evidence → adjust policy → batch settle |
| **Research** | Papers driving downstream work → reward authors |
| **Music** | Listening history → verify attribution → user-centric settlement |

---

## API → layer map (capabilities, not UI)

| Layer | Capabilities | Implementations |
|-------|--------------|-----------------|
| Observation | Code, music, research, feeds, video | GitHub, Navidrome, OpenAlex, RSSHub, PeerTube… |
| Intelligence | Reasoning, embeddings, search | Gemini, Llama, OpenRouter, graph engine |
| Knowledge | Entities, relationships, resolution | `lib/domain`, graph store (Layer 4) |
| Capital | Treasury, Arc, FX, claims | Circle, Gateway, wallets |
| Communication | Alerts | Resend, webhooks |
| Identity | OAuth, wallets | GitHub, Reown, ORCID, ENS |

**Never** build a UI page because an API exists.

---

## Visual identity

> *The place where you can literally see value moving through the open internet.*

The **Global Value Graph** is the product — not decoration. Not a GitHub funding tool. Not a crypto wallet.

---

## Implementation status (honest)

| Area | Status |
|------|--------|
| Layer 1 domain model | Frozen (`src/lib/domain/`) |
| 6-tab routes | Wired (`src/components/resolve/layout/nav.ts`) |
| Mission 3-column shell | Partial (`/mission`) |
| Entity pages | Not started |
| Global value graph | Not started |
| Command bar ⌘K | Not started |
| Observation ingest | Partial (legacy `SettlementInputEvent`) |

**Rule:** No new primary tabs until entity pages or graph ship.
