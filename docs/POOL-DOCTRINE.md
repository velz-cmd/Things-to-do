# Pool doctrine — Discover vs Mission

**Status:** Product law (July 2026). Supersedes any UI that lets one person **allocate** a **communal** pool.

---

## Two pool types (do not mix)

| | **Communal pool (Discover)** | **Private batch (Mission)** |
|--|------------------------------|-----------------------------|
| **Who owns it** | Network / community — **everyone’s stakes, one pool** | **Your** community operator wallet + your rules |
| **Who controls payout** | **Nobody manually** — autopay at milestone | **You** — founder/funder approves batch |
| **Human UI** | **Fund only** (add USDC). Read milestone + autopay status. | **PDF upload** → AI reads → set % per payee → **Arc memo batch** |
| **Tab** | Discover (+ Capital for your stake receipt) | Mission |
| **Sensors / connectors** | Profile + Discover | **Not Mission** |

---

## Communal pool (Discover)

1. One aggregated pool per community (`community-pool-state`).
2. Funders **deposit**; they do **not** pick payees or weights.
3. When the pool hits a **milestone** and obligations are ready, **`tryCheckpointBatchSettle` / cron** pays — no “Settle on Arc” button on Discover.
4. Discover cards show: balance, milestone progress, **“Autopay at checkpoint”** — not allocation sliders.
5. **No `create_program` / grant pool / docs bounty** from Discover bubble console — operators use Communities when we expose that later.

**Mission handoff for communal fund:** Mission may show **read-only** pool status + link **“Add funds on Discover”** — never Authorize/Simulate/Policy on communal money.

---

## Private batch (Mission)

For operators with a **community wallet** and allocation proof (PDF, memo, board resolution):

1. Upload PDF in Mission → evidence ingest → AI extracts payees / amounts / %.
2. Funder edits the batch table (percentages must sum to 100%).
3. **Simulate** → **Execute Arc batch** (memo tech) — pays **their** list, not the communal ledger queue.

This is **not** the Discover communal pool.

---

## Profile & Discover own connectors

- GitHub, Navidrome, sensors: **Profile → Connections** and **Discover** (connect / proof).
- Mission does **not** nudge connectors or host sensor managers.

---

## Future pool UI

If we need operator-facing communal pool controls later, we will spec it explicitly — **not** on Discover cards and **not** as Mission Blueprint authorize today.

---

*Last updated: pool doctrine alignment PR.*
