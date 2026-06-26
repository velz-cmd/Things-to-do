# RESOLVE — Product Vision & Experience Blueprint (V1)

**Status:** Final product vision — frozen alongside [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md) and [ENGINEERING-SPEC.md](./ENGINEERING-SPEC.md).  
**Companion:** [PRODUCT-BLUEPRINT.md](./PRODUCT-BLUEPRINT.md) (journeys, surfaces, gap analysis).  
**Does not replace:** doctrine (why) or engineering spec (how).

If any future feature, UI, connector, or API does not align with this document, challenge the implementation before writing code.

---

## 1. First principle

We are not building another dashboard.

We are not building another crypto application.

We are not building another GitHub tool.

We are building **invisible economic infrastructure**.

People should remember the value they discovered, not the software they used.

The product should feel closer to Stripe, Linear, Cursor, Notion, or Vercel than a hackathon demo.

Simple on the surface. Extremely sophisticated underneath.

---

## 2. Distribution first

The biggest lesson from the Distribution Bootstrap essay is not payments. It is **distribution**.

Every feature should answer one question:

> How does this inherit an existing community instead of requiring us to build one?

Examples: GitHub · Navidrome · PeerTube · Owncast · RSSHub · Mastodon · Immich · future ecosystems.

Users should continue using those ecosystems exactly as they already do.

RESOLVE quietly observes → recognizes value → authorizes value → settles value.

The creator should not need to discover RESOLVE before value starts accumulating.

**Target loop:**

```
continue working → value recognized → notification arrives → creator discovers RESOLVE
```

**Not:**

```
discover RESOLVE → create account → upload work → hope people use it
```

---

## 3. Product philosophy

We never ask: *"What should users upload?"*

We ask: *"Where is value already being created that nobody settles today?"*

Every Distribution Connector exists to answer that question.

---

## 4. Value before money

Money is not the product. Money is the consequence.

The product discovers:

- who created value
- who consumed value
- how often
- how much evidence exists
- what policy applies

Settlement fulfills those facts. Settlement never creates them.

Always think:

```
Value → Authorization → Settlement
```

Never:

```
Treasury → Founder → Reward
```

---

## 5. Hidden complexity

The frontend should never expose backend architecture.

Users should never care about: Settlement Core, Weight Engine, scoring, Sybil, Registry, policies, proofs, queues, workers, batch processors.

These exist. They remain invisible.

The UI should answer only:

- Where is value?
- Who earned?
- Why?
- What happens next?

---

## 6. Real product rule

Never build fake data. Never build cosmetic APIs. Never create placeholder metrics.

Every API integrated into RESOLVE must produce real value.

| Integration | Requirement |
|-------------|-------------|
| GitHub | Real repositories, real contributors |
| Navidrome | Real scrobbles |
| MusicBrainz | Real metadata |
| PeerTube | Real playback events |
| RSS | Real feeds |

If an API cannot provide real functionality yet, **hide the feature** until it can.

Quality is more important than feature count.

---

## 7. Universal creator economy

GitHub is not special. Music is not special. Video is not special. Photography is not special. Documentation is not special.

Every ecosystem follows the same pattern:

1. Someone creates value.
2. Someone else consumes that value.
3. Economic recognition is missing.

RESOLVE exists to recognize and settle that value.

The long-term vision is not GitHub payments. It is **programmable settlement across every digital ecosystem**.

---

## 8. Value graph

Beyond the essay lies a core opportunity: every community already contains a hidden **Value Graph** — not a social graph, not only a dependency graph.

### Software

```
Company → Revenue → Product → Dependency → Contributor → Reviewer → Maintainer
```

### Music

```
Listener → Song → Composer → Producer → Engineer
```

### Publishing

```
Reader → Article → Researcher → Editor → Writer
```

### Photography

```
Viewer → Photo → Photographer → Designer
```

### Video

```
Viewer → Video → Editor → Creator → Moderator
```

### Communities

```
Member → Discussion → Moderator → Maintainer → Documentation author
```

**RESOLVE converts Value Graphs into Payment Graphs.**

We never invent attribution. We consume attribution communities already maintain.

### Upstream creators (your library example)

Someone writes `left-pad`. Ten thousand products depend on it. Downstream companies earn; the library author earns nothing.

The essay covers **consumption → attribution → settlement** (listen → artist, watch → creator, merge → contributor). It does **not** define automatic revenue share from downstream earners to upstream dependencies.

That is a **policy** question, not a settlement infrastructure question.

RESOLVE should expose:

- who created the dependency
- who consumes it (installs, imports, citations, API calls)
- how often
- what policies the **community or operator** chose

RESOLVE executes policies. It does not decide that 0.1% of SaaS revenue flows to transitive OSS authors — unless a community configured that policy.

---

## 9. Payment policies

RESOLVE should never decide what people deserve.

Communities decide. Operators decide. Businesses decide. Creators decide.

RESOLVE executes transparent **payment policies**.

| Policy type | Example |
|-------------|---------|
| Per play | 1¢ → artist |
| Per second watched | → streamer |
| Per citation | $2 → author |
| Per download | → photographer |
| Per dependency signal | → maintainer (when policy exists) |
| Per plugin execution | → plugin author |
| Revenue share | → ecosystem (operator-defined) |

Infrastructure executes. Governance chooses.

**Avoid:** automatic “cut a slice from everyone who earns” without an explicit policy and funder — that crosses into tax/royalty governance RESOLVE does not own.

---

## 10. User experience

Every screen answers one question.

| Surface | Question |
|---------|----------|
| **Home** | What is happening? / Where should we attach? |
| **Activity** | Where is value? |
| **Earnings** | What has been authorized, funded, claimed, settled? |
| **Connections** | What ecosystems are connected? |
| **Account** | Who am I and how do I receive value? |

No screen exists because the backend has another subsystem.

---

## 11. Real company standard

Build every screen as if RESOLVE will be used by:

- large OSS foundations
- music communities
- media servers
- AI platforms
- research organizations
- open protocols
- enterprise operators

Never optimize for judges, screenshots, or hackathons.

Optimize for software that still feels modern five years from now.

---

## 12. Development rule

Before implementing any feature, ask:

1. Where is value already created?
2. Which existing ecosystem owns it?
3. Which metadata already describes it?
4. Which connector observes it?
5. How is authorization generated?
6. How is settlement fulfilled?
7. How can the experience remain simpler than the complexity underneath?

If a feature cannot answer those questions, do not build it.

---

## 13. Core abstraction (build around this)

Every connector produces the same normalized **value event** (`SettlementInputEvent`):

```
Connector event → Authorization → (policy) → Settlement → Claim
```

Add PeerTube, Owncast, RSS, docs, mods, MCP tools — **without redesigning the product** — by extending connectors and policies, not the ledger.

---

## 14. Build priorities (post-freeze)

Stop rewriting prompts. Execute in order:

1. **Product UX** — polished SaaS; connect-first Home; Activity · Earnings · Connections · Account
2. **GitHub production** — real data, passive authorization path, notification → claim loop
3. **Navidrome** — one fully working second connector (operational scrobble ingest, not manual POST)
4. **Real APIs only** — no placeholders, fake stats, cosmetic integrations
5. **Value events everywhere** — one abstraction end-to-end

---

## Final mission

RESOLVE becomes the invisible economic operating system for digital communities.

Not by replacing ecosystems. Not by creating new creator platforms.

By attaching permissionlessly to communities that already exist, recognizing value that already flows, authorizing automatically, and enabling transparent programmable settlement.

**Make invisible value visible.**  
**Make visible value measurable.**  
**Make measurable value payable.**

Everything else is implementation.
