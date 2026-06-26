# RESOLVE — Final Product Direction (Frozen)

**Status:** Canonical product direction. **Stop creating philosophy documents** unless architecture fundamentally changes.  
**Related (frozen):** [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md) · [ENGINEERING-SPEC.md](./ENGINEERING-SPEC.md)  
**Supersedes for product decisions:** [PRODUCT-VISION.md](./PRODUCT-VISION.md), [PRODUCT-BLUEPRINT.md](./PRODUCT-BLUEPRINT.md) — read those for detail; this doc wins on conflicts.

Every new feature must make the product more useful, not more complicated.

---

## 1. One platform. Infinite communities.

RESOLVE is not a GitHub product. Not a music product. Not a payments dashboard.

It is **universal settlement infrastructure** that attaches to any community where value is created but money does not naturally flow.

Every connector feeds the same Settlement Core.  
Every connector uses the same Authorization Ledger.  
Every connector uses the same Attribution Registry.

The backend becomes more powerful over time. The frontend stays almost identical.

**Never** build separate experiences for GitHub, Navidrome, PeerTube, writers, designers, photographers, moderators, or future communities.

Build **one experience** that automatically adapts to the connected ecosystem.

---

## 2. Two value patterns. One engine.

The essay proves **Pattern A**. The product extends with **Pattern B**. Same pipeline. Never fork.

### Pattern A — Consumption

Someone consumes work.

| Event | Payee |
|-------|-------|
| Listen | Artist |
| Watch | Creator |
| Read | Writer |
| Cite | Researcher |
| Merge | Contributor |
| Play | Musician |

### Pattern B — Upstream value

Someone creates value **using** another person's work.

- App earns using an OSS library
- Designer template powers thousands of projects
- Documentation reduces support costs
- Moderator grows a community
- Dataset powers an AI model
- Plugin powers another application
- Framework powers SaaS revenue

These are **not** different products. They are different `SettlementInputEvent` types:

```
Connector → Authorization → Policy → Settlement → Claim
```

Only add connectors and event types. Never fork the architecture.

---

## 3. Make value visible before money.

Users discover RESOLVE because value **already exists** — not because they opened our website, got invited, or pasted a repository.

Notifications are acquisition:

- *"You've earned $18.42"*
- *"This project has authorized value waiting."*
- *"This documentation has generated attribution."*
- *"This library has been used in 8,400 builds."*

**Notification → claim → onboarding.** Money becomes discovery.

---

## 4. Remove founder control wherever possible.

Reduce founder-operated UX every release.

| Should be automatic | Operators provide |
|---------------------|-------------------|
| Authorization | Capital (fulfillment) |
| Connector observation | Transparent policies |
| Self-service claims | — |

Operators fund obligations. They do **not** decide whether value happened.

Passive authorization = essay fidelity.

---

## 5. Every API must be real.

No fake dashboards. No placeholder metrics. No cosmetic integrations.

- Every number on screen → real API
- Every connector → real requests
- Every activity feed → real events
- Every balance → ledger
- Every status → honest reality

Testnet settlement is acceptable. Fake data is not.

---

## 6. UI philosophy

Feel like **Linear, Notion, Cursor, Stripe** — not a blockchain explorer, hackathon dashboard, or admin panel.

Calm. One action per screen. Heavy work in the background.

Users never need to understand: attribution graphs, weighting, batching, connectors, blockchain.

They understand outcomes:

- What happened?
- What did I earn?
- Why?
- What should I do next?

---

## 7. Home should not ask for repositories.

Long-term Home answers:

> *Where is value already being created that nobody is settling?*

Users connect identities. RESOLVE discovers opportunities.

Do not require manual paste of repos, packages, or projects. Connectors discover them. **Manual input is a bridge, not the destination.**

---

## 8. Product grows without growing the interface.

As we add GitHub, Navidrome, PeerTube, Owncast, RSS, npm, Docker, MCP, documentation, photos, datasets, design assets — the interface **barely changes**.

Backend: exponentially smarter. Frontend: simple.

This is the scalability principle.

---

## 9. Long-term vision

The world's ecosystems already know who created value. They simply don't settle it.

RESOLVE observes existing value, authorizes automatically, fulfills when funding exists.

**Goal:** unlock economies that already exist — not create new ones.

---

## 10. Current milestone (engineering focus)

Do **not** implement every connector now. Narrow focus:

| Priority | Deliverable |
|----------|-------------|
| **1** | GitHub **production-ready** — real data, passive authorization path, notification → claim |
| **2** | **Navidrome** — one non-GitHub connector **end-to-end and automatic** (not manual POST) |
| **3** | **Platform extensibility** — connector #3, #4, #50 is mostly configuration, not rewrite |

If these three ship well: convincing demo + architecture that scales to the full vision.

---

## Mission (one line)

**Make invisible value visible. Make visible value payable.**

Everything else is implementation.
