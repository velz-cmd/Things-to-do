# Discover UI restoration

UI reference: commit `94fb1e2`, the last main commit before `ffe840b` replaced the complete Discover page with the standalone Proof-to-Pool dashboard.

The restoration keeps the server-side GitHub intelligence builder, persisted repository snapshots, evidence APIs, policy coverage, pool operations, obligations, supporter benefits, settlement receipts, and Mission handoff introduced by `ffe840b` and `6fac139`.

## Restored structure

- Discover command header and global search
- Existing quick action rail
- Live Arc and network status strip
- Unpaid Work
- Live Signals
- Ready to Fund
- Existing workspace navigation and filters
- Existing opportunity board
- Existing value graph
- Pools as the primary user-facing financial concept
- Mission, Capital, Communities, evidence, and receipt handoffs

## Action comparison

| Previous action | Previous location | Current redesign replacement | Restoration |
| --- | --- | --- | --- |
| Search | Command header | Repository-only input | Global Discover search restored. Repository source selection is a compact context control. |
| Unpaid Work | Workspace lane | Recognition debt panel | Restored as a compact Discover signal backed by persisted GitHub evidence. |
| Live Signals | Workspace lane | Repository delta and activity panels | Existing lane restored. GitHub proof count and source status appear in the compact intelligence row. |
| Ready to Fund | Workspace lane | Funding coverage dashboard | Restored with persisted shortfall and checkpoint values. |
| Open pool / fund pool | Pool cards | Deposit in Capital | Pool naming and card hierarchy restored. Capital remains the real funding handoff. |
| View checkpoint | Pool cards | Program link | Restored as a direct program and checkpoint action. |
| Review allocation | Pool cards | Embedded allocation panels | Restored as real program navigation. No manual recipient or weight controls were added. |
| Inspect / view evidence | Work cards | Proof on GitHub | Restored in Unpaid Work with the persisted evidence endpoint. |
| Open contributor | Contributor cards | Resolve blocker | Restored through the persisted identity recovery route. |
| Start Mission | Work and decision context | Decide in Mission | Restored with the existing persisted Mission creation API. |
| View receipt / transaction | Outcomes | Outcome proof panel | Restored when confirmed receipt records exist. |
| Refresh | Command or context bar | Analyze repository / refresh snapshot | Restored as a compact repository action with loading, error, and success states. |
| Repository selection | Command or context bar | Large connected ecosystem section | Restored as a compact selector that preserves the `repo` URL context. |

## Intentionally hidden

- Manual recipient selection and payout weights. Pool doctrine routes recipients through versioned policy and verified obligations.
- Manual communal settlement. Discover pools settle through checkpoint automation.
- Empty receipt or transaction buttons. They render only when a confirmed persisted outcome exists.
- Sample pools and fake balances. The empty state appears when no persisted pool exists.
