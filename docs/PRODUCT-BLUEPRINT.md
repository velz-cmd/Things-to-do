# RESOLVE Product Blueprint v1.0

**Status:** Product north star — supersedes screen-level UX decisions until v1 ships.  
**Does not replace:** [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md) (why) · [ENGINEERING-SPEC.md](./ENGINEERING-SPEC.md) (how)  
**Full vision:** [PRODUCT-VISION.md](./PRODUCT-VISION.md) — value graphs, policies, mission (frozen).  
**Supersedes for product:** interim four-tab layout (Workspace / Payments / Connectors / Profile) — that was an engineering cleanup, not the final model.

---

## 1. What company we are building

RESOLVE is not a dashboard founders visit to run analysis.

RESOLVE is a **settlement network** that attaches to ecosystems where value already exists. Most users never “sign up to use RESOLVE.” They **keep using GitHub, Navidrome, PeerTube, Owncast, RSS, Mastodon, Immich** — and the network records what they earned.

| Wrong mental model (tool) | Right mental model (network) |
|---------------------------|------------------------------|
| Founder visits RESOLVE | Connector observes where users already are |
| Pastes repo, runs analysis | Authorization happens at event time |
| Funds treasury | Settlement fulfills when capital exists |
| Users maybe get paid | Creator receives “You’ve earned $X” |
| Paid / founder-led acquisition | **Passive discovery** — earn first, discover RESOLVE later |

**Nobody visited RESOLVE** is the design test for the default path.

---

## 2. First principles answers

These answers drive every screen, API, and connector priority.

### Who is the first user?

**Primary:** A **creator who discovers they earned something** — OSS contributor, artist, podcaster, photographer, video operator — without having heard of RESOLVE before.

**Secondary:** A **community operator** (instance admin, maintainer, label, collective) who connects an ecosystem so their people get settled.

**Tertiary (not the homepage hero):** A **funder** who fulfills obligations already recorded in the ledger — not someone who “starts” value by pasting a repo.

> Ship order: **creator discovery loop first**, operator connect second, funder fulfill third.

### What is the first action?

**Not:** Paste a repository.  
**Yes:** **Connect an ecosystem** (or receive a claim because a connector already did).

Home asks: *Where does value already exist?* — GitHub · Navidrome · PeerTube · Owncast · RSS · Mastodon · Immich → **Connect**.

After connect, the system runs. No “Analyze” button required for the default experience.

### What is the “aha!” moment?

**Not:** Seeing an AI analysis dashboard.  
**Yes:** *“I was already doing my work — and money was owed to me.”*

Examples:
- Email / notification: **“You’ve earned $27 from usage of your work. Claim →”**
- Activity feed: **“124 plays · $4.80 authorized · settlement pending funding”**
- Claim screen: **real payee, real connector, real amount** — not a demo scorecard

### How does the second user arrive?

**Not:** Marketing landing → sign up → paste repo.  
**Yes:** **Viral acquisition from activity**

```
Keep using GitHub / Navidrome / PeerTube / …
        ↓
Connector detects value (contribution or consumption)
        ↓
Authorization recorded
        ↓
“You’ve earned $X” (email, RSS, webhook, in-ecosystem notice)
        ↓
Creator claims → now has a RESOLVE account
        ↓
Tells the next creator
```

Founder-led analyze is a **power tool**, not the product front door.

---

## 3. User types and lifecycles

### A. Creator (default)

Someone identified by upstream metadata (git author, MusicBrainz artist, `attributedTo`, etc.).

| Stage | Experience | Backend (invisible) |
|-------|------------|---------------------|
| **0 — Unaware** | Uses GitHub / listens on Navidrome / publishes on PeerTube | Connector ingests events |
| **1 — Owed** | Notification: earned amount, source ecosystem, claim link | Authorization `authorized` or `claimable` |
| **2 — Claim** | Connect wallet / GitHub identity, one-click claim | Settlement Core fulfillment |
| **3 — Resident** | Earnings history, per-source breakdown, pending vs settled | Ledger + Attribution Registry |
| **4 — Advocate** | Shares claim link; invites operator to connect instance | Referral metadata (future) |

**Language:** earnings, owed, claim, your work — never “mission,” “treasury,” “allocate.”

### B. Community operator

Maintainer, instance admin, collective lead. Connects ecosystems on behalf of many creators.

| Stage | Experience |
|-------|------------|
| Connect source | OAuth / plugin / sidecar install |
| Monitor | Activity: events today, authorizations, health |
| Optional fund | Fulfill pending obligations for their community (not create value) |

**Language:** connected sources, your community, pending fulfillment.

### C. Funder (fulfillment role)

Treasury holder who **fulfills** authorizations already in the ledger — does not “decide who deserves pay” in the primary narrative.

| Stage | Experience |
|-------|------------|
| See queue | Total authorized, pending funding, by ecosystem |
| Fulfill batch | Approve settlement run (operator/funder UI — not creator UI) |
| Receipt | Audit trail, on-chain or off-chain proof |

**Language:** fulfill, fund settlement, clear the queue — not “reward contributors.”

### D. Platform (RESOLVE itself)

Invisible. Users think in ecosystem nouns (repo, album, channel, feed), not RESOLVE subsystems.

---

## 4. How value and money enter

### Value enters (always via connectors)

```
Upstream event (merge, scrobble, view, download, cite, post)
        ↓
Distribution Connector normalizes → SettlementInputEvent
        ↓
Attribution Registry resolves payee
        ↓
Authorization Ledger: status = authorized
```

No value enters by “founder analysis” in the v1 story — analysis is **batch attribution** for GitHub-sized graphs, still emitted as connector events.

### Money enters (fulfillment, not permission)

```
Authorizations exist (economic facts)
        ↓
pending_funding — owed, not yet funded
        ↓
Funder / operator / protocol treasury fulfills batch
        ↓
claimable → creator claims → settled
```

**Copy rule:** Value exists → Money owes → Settlement fulfills.  
Never: Founder funds → People get paid (as the primary story).

---

## 5. Product surfaces (v1 target)

User words, not engineering words.

| Surface | User question | Replaces (interim) |
|---------|---------------|-------------------|
| **Home** | Where should RESOLVE attach? | Marketing “paste repo” |
| **Activity** | What’s happening across my connected world? | Workspace + live feeds |
| **Earnings** | What am I owed / what did I receive? | Payments (claim + history) |
| **Connections** | What ecosystems are linked? | Connectors |
| **Account** | Who am I? | Profile |

### Home (connect-first)

```
Choose where value already exists

○ GitHub    ○ Navidrome    ○ PeerTube
○ Owncast   ○ RSS          ○ Mastodon
○ Immich

[ Connect → ]
```

No treasury field. No analyze button on first visit.

### Activity (what’s happening)

Live, cross-ecosystem — not a founder analysis wizard.

```
Recent value

  navidrome/navidrome     12 contributors · $381 pending
  @artist — 124 plays     $4.96 authorized
  peertube/channel        41 min watched · $2.10 authorized
```

Progressive disclosure: **Why?** → evidence, AI reasoning, raw metadata.

### Earnings (creator-centric)

Centered on **person**, not repository.

```
Owed          $127.40   (authorized + pending funding)
Claimable     $43.00
Received      $1,204.00   (settled)

[ Claim all ]
```

### Connections (ecosystem-centric)

```
GitHub          ✓ Connected    23 events today
Navidrome       ✓ Connected    last sync 14s ago
PeerTube        Add source
```

### Account

Identity, wallet, notifications, API keys (operators), preferences.

---

## 6. What stays invisible

Users never see these as product nouns:

| Invisible | Why |
|-----------|-----|
| Authorization Ledger | They see “earned” / “owed” |
| Settlement Core | They see “claim” / “received” |
| Weight / Signals / Evidence OS | Behind “Why?” |
| Agents / pipelines / queues | Automatic |
| Distribution Connector (term) | They see “GitHub” / “Navidrome” |
| Nano payments, Arc, batch numbers | Receipt detail only |

Stripe does not say “PaymentIntent API.” RESOLVE does not say “SettlementInputEvent.”

---

## 7. Experience timeline

### First 30 seconds

- Land on **Home** → pick ecosystem → connect (or land on **claim link** from email)
- No jargon, no treasury, no analysis progress bars

### First 5 minutes

- See **Activity**: real events from connected source OR claim preview from notification
- Understand: *“Money is owed because people used my work”*

### First 30 days

- **Earnings** grows from passive connector activity
- Occasional **fulfillment** when funders clear the queue
- **Connections** may add second ecosystem
- RESOLVE feels like infrastructure they **already benefited from**, not a tool they adopted

---

## 8. Current build vs blueprint (honest gap)

| Blueprint v1 | Shipped today (June 2026) | Gap |
|--------------|---------------------------|-----|
| Connect-first Home | Paste repo + Analyze | **Wrong front door** |
| Passive creator discovery | Founder must run GitHub analyze | **No notification loop** |
| Activity feed (cross-ecosystem) | Workspace = GitHub-only wizard | **Wrong center of product** |
| Earnings (creator-centric) | Payments = treasury + founder queue | **Wrong protagonist** |
| Navidrome auto-ingest | Manual POST to scrobble API | **Not operational** |
| Nobody visited RESOLVE | Founder visits to start flow | **Centralized UX** |

**Backend convergence is real.** Ledger, connectors contract, settlement lifecycle — aligned with doctrine.  
**Product convergence is not.** UI still optimizes for the founder who already knows RESOLVE exists.

---

## 9. Implementation priority (after blueprint freeze)

Do not add screens. Execute in this order:

1. **Notification + claim entry** — email/webhook: “You’ve earned $X” → `/claim?token=…` (creator aha, no signup first)
2. **Home → Connect** — replace paste-repo hero; route to Connections setup per ecosystem
3. **Rename / restructure nav** — Activity · Earnings · Connections · Account
4. **Activity feed** — real data from Authorization Ledger grouped by ecosystem + creator
5. **Navidrome operational bridge** — scrobble stream → ledger without manual POST
6. **Fulfillment UI** — move “fund treasury / fulfill” out of creator path into operator/funder path
7. **Deprecate founder-first Workspace** — keep as power tool behind Connections → GitHub → Advanced

---

## 10. Success metrics (product, not vanity)

| Metric | Meaning |
|--------|---------|
| % authorizations from **passive connector events** vs founder analyze | Network vs tool |
| Creators who **claimed without prior signup** | Viral discovery works |
| Time from upstream event → notification sent | Loop latency |
| Connected ecosystems per operator | Distribution breadth |
| Claim rate within 7 days of notification | Earnings UX works |

---

## 11. One sentence

**RESOLVE is the settlement layer people discover when their existing work starts earning money — not a website they visit to decide who to pay.**

---

*Blueprint v1.0 — frozen for product decisions. Engineering continues against ENGINEERING-SPEC; UI work must converge to this document, not expand interim dashboards.*
