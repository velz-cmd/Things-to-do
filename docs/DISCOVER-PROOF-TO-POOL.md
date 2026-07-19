# Discover Proof-to-Pool system

Discover is RESOLVE's read-oriented economic intelligence surface. It explains how activity becomes proof, how attribution and active policy determine recognition, and how communal capital can reach payout-ready contributors. Discover does not choose recipients, mutate policy, authorize settlement, or manufacture financial state.

## Entry paths

| Path | Source of truth | Result |
|---|---|---|
| Connected ecosystem | Canonical Profile `SourceConnection` and persisted repository snapshots | Reopens repositories already associated with the connected GitHub identity without another OAuth flow |
| Public repository analysis | GitHub repository/activity APIs and supported dependency manifests | Persists an immutable repository snapshot plus normalized `Evidence` records |
| Community pools | Active/deployed programs, normalized program/policy versions, confirmed stakes, authorizations, checkpoints, transactions, and receipts | Shows real pool state and routes funding operations to Capital |

## Proof and attribution

A repository capture stores every accepted GitHub activity record as an immutable `Evidence` row keyed by kind, external ID, and content hash. Supported `package.json` runtime, peer, and optional dependencies are stored as dependency evidence. Dependency maintainers remain unresolved until a real identity record exists; no upstream allocation is described as payable before identity and payout readiness are verified.

The attribution graph is derived at read time from the selected immutable snapshot, its evidence, active program/policy versions, persisted pool records, and confirmed receipts. Recognition debt means verified activity has no active matching policy. A repository funding-gap amount remains explicitly labeled a modeled estimate; only persisted authorizations are described as owed.

## Communal pool lifecycle

Each pool exposes confirmed capital, available capital, recognized obligations, deterministic queued payees, policy version, checkpoint progress, and five readiness conditions: funding, obligations, recipients, payout readiness, and normalized policy. Optional retroactive funding, quadratic matching, and dependency support appear only when the active program configuration contains them.

Funding continues through Capital. A confirmed stake can materialize only community-defined, non-financial supporter benefits in `SupporterBenefitLedger`. Deposit-gated benefits activate after the deposit is confirmed. Checkpoint-gated benefits activate only after the paid checkpoint is recorded. Pending or failed Arc transfers do not create benefits.

## Truth and ownership boundaries

- Profile owns identity and source connections.
- Communities owns program and policy configuration.
- Capital owns deposits, authorization, and settlement operations.
- Discover owns repository capture, evidence explanation, coverage, recognition-debt analysis, and navigation to the operating surface.
- Submitted settlement state is never shown as a confirmed outcome. Outcome rows require a confirmed batch, persisted transaction hash, and issued receipt.
- Empty, degraded, and signed-out states remain explicit. Static examples are never presented as live economic activity.
