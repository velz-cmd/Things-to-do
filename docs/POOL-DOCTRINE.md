# Pool doctrine — Discover vs Mission

**Status:** Product law (July 2026).

---

## Three pool surfaces (do not mix)

| | **Discover communal** | **Mission fulfill** | **Mission personal pool** |
|--|----------------------|---------------------|---------------------------|
| **Who owns it** | Network / community | Same pool — read from Discover | **You** — pool owner |
| **Linked?** | Canonical on Discover | Lists active Discover programs | **Not** linked to Discover |
| **Human UI** | Fund + milestone · autopay | **Fulfill pool only** (add USDC) | Pool size · milestone · PDF payees · Arc batch |
| **Tab** | Discover (+ Capital stake) | Mission | Mission |

---

## Discover communal pools

1. One aggregated pool per community program.
2. Funders deposit; autopay at milestone from the authorization ledger.
3. **Discover** is the home for browsing and funding communal pools.

---

## Mission — fulfill pool (Discover pools)

1. User asks e.g. “most active pool” → Mission shows **active programs from Discover**.
2. **Only action:** Fulfill pool (add USDC) with wallet picker.
3. **No** communal pool simulation, milestone editor, or allocation UI on Mission.
4. **No** read-only communal pool status panel — fulfill or link to Discover.

---

## Mission — personal pool (owner)

For operators who want **their own** pool (not the communal ledger):

1. Create/name pool, set **pool size** and **milestone** (any values).
2. Upload **PDF** as evidence for **your payee list** (names / `0x` wallets + %).
3. Simulate batch → **Execute Arc batch** to your list.
4. **Not** tied to Discover communal `programId`.

---

## Blueprint (Mission)

Settlement **design** after agent intel — simulate policy and export. Does **not** fund or simulate Discover communal pools.

---

*Last updated: mission pool split PR.*
