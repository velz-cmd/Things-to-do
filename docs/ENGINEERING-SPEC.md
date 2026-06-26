# RESOLVE — Engineering Specification (Frozen)

**Deadline:** July 6, 2026 · **Obey:** [FOUNDING-PRINCIPLES.md](./FOUNDING-PRINCIPLES.md)

---

## July 6 ship list

| Priority | Deliverable |
|----------|-------------|
| P0 | Authorization ledger (`authorized` → `pending_funding` → `claimable` → `settled`) |
| P0 | GitHub Distribution Connector → authorizations on analyze |
| P0 | End-to-end: event → authorization → fund fulfillment → settlement → claim |
| P0 | V2 UX (Home / Workspace / Payments / Profile) |
| P1 | Navidrome scrobble connector (demo ingest → authorization) |
| P2 | Post-deadline: Mastodon, Immich, RSSHub, full usage graph |

---

## Architecture

```
Distribution Connectors (src/lib/connectors/)
        │ SettlementInputEvent
        ▼
Attribution consumer + evidence (Weight / Sybil)
        │ AuthorizationRecord
        ▼
Authorization ledger
        ▼
Settlement Core (src/lib/payment/)
        ▼
Rail (Arc — swappable)
```

---

## Authorization states

| State | Meaning |
|-------|---------|
| `authorized` | Consumption/contribution recognized; amount owed |
| `pending_funding` | Owed; fulfillment queue unfunded |
| `claimable` | Funded; contributor may claim to wallet |
| `settled` | Fulfilled (on-chain or finalized) |

APIs:
- `POST /api/authorization/from-allocation` — GitHub analyze → authorize all contributors
- `POST /api/authorization/ingest` — generic connector events
- `GET /api/authorization/summary` — owed totals by repo/mission
- Settlement routes **fulfill** authorizations (do not create them)

---

## Connector contract

`src/lib/connectors/types.ts` — `SettlementInputEvent` with `payeeKeys[]` from **upstream metadata only**.

Navidrome: `src/lib/connectors/navidrome.ts` — scrobble → MusicBrainz/github registry stub.

---

## UX

- Operational interface: Workspace (not "the product brand")
- Copy uses **authorization** / **earned** / **pending funding** / **settled**
- Integrations panel: GitHub ✓ · Navidrome (demo) · others upcoming
- No connector numbers in public UI

---

## Definition of done (each PR)

- [ ] Which connector + which metadata field?  
- [ ] Authorize at ingest?  
- [ ] Principles doc not violated?
