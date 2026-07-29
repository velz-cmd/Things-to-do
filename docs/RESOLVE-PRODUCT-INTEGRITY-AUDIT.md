# RESOLVE product integrity audit

Audit date: 2026-07-29
Baseline: `3a0040711f1bcc6c46d89b617e48c66fdcc7ae90`

## Integrity policy

RESOLVE exposes a financial success state only when it can identify:

1. the financial record
2. the provider or chain transaction reference
3. the network
4. the sender
5. the recipient or Pool
6. the asset
7. the amount
8. authoritative confirmation
9. the issued receipt

Missing any item keeps the record in configured, calculated, authorized, claimable, submitted, failed, stale, or provenance-unavailable state.

## Production integrity findings

| Finding | Evidence | Severity | Resolution |
| --- | --- | --- | --- |
| Discover ignored selected view | API did not pass `view` to marketplace query | Critical | Repaired |
| Stake ledger shown as confirmed funding | $256 in stake principal, 0 chain transactions, 0 receipts | Critical | Repaired |
| Off-chain fake contributor hashes | executor created `offchain-*` values while Arc disabled | Critical | Removed |
| Off-chain fake nano hashes | executor created `offchain-nano-*` values while Arc disabled | Critical | Removed |
| Treasury accepted off-chain settlement | gate returned `ok: true` without live Arc | Critical | Blocked |
| Global settlement fulfilled without chain execution | fulfillment ran after an off-chain branch | Critical | Blocked before fulfillment |
| Fake escrow reference | payment orchestrator stored `escrow:*` as an escrow hash | Critical | Removed |
| Public Pool setup incomplete | active templates lacked publication approval, policy, treasury, and provenance | High | Hidden until ready |
| Repeated public programs | template records projected as separate public cards | High | Publication gate plus database identity constraint |
| Historical wallet unit corruption | 127 rows, absolute total $250,963,120 | Critical | Quarantined by migration and hidden from read models |
| Schema drift | 4 Prisma models absent from production | High | Additive migration |
| Live settlement endpoint timeout | N+1 reads across stake, authorization, mission, and Pool state | High | Replaced by one bounded authoritative query |
| Action inventory incomplete | 969 controls, 131 registered, 838 unregistered, 0 unknown IDs | High | Existing controls remain inventoried, financial controls are gated, full registration remains follow-up work |

## Public provenance rules

### Allowed for publication

- `external_user`
- `external_integration`
- `operator_created`

### Preserved but not automatically public

- `administrative_import`
- `research_import`
- `legacy_migration`
- `unknown_provenance`

### Always quarantined from production action surfaces

- `test_fixture`
- `development_seed`
- `synthetic_demo`
- invalid ownership
- invalid payout destination
- untraceable amount
- duplicate active publication
- database-only simulation presented as money movement

## Financial model classification

| Model | Meaning | Can prove payment by itself |
| --- | --- | --- |
| `PaymentAuthorization` | approved or pending obligation | No |
| `CommunityFundStake` | internal program stake ledger | No |
| `WalletTransaction` | account activity/read model | No |
| `MissionSettlement` | legacy settlement workflow record | No |
| `FundingIntent` | requested financial operation | No |
| `SettlementBatch` | prepared or submitted batch | No |
| `ChainTransaction` | provider or chain execution record | Only when confirmed and complete |
| `Receipt` | issued proof linked to a chain transaction | Yes, with its confirmed chain transaction |

Production had no qualifying `ChainTransaction` or `Receipt` at audit time. Confirmed public settlement volume is therefore zero.

## Action integrity

The action audit completed with:

- 969 visible controls found
- 131 registry entries
- 838 controls not yet represented in the registry
- 0 unknown action IDs
- 0 dead route patterns

This means route-backed controls are discoverable and no registered action points to an unknown action ID. It does not mean every control has the full contract required by the product brief.

The repaired financial controls follow these rules:

| Action | Precondition | Failure behavior | Success authority |
| --- | --- | --- | --- |
| Add USDC to Pool | approved public Pool, active policy, treasury, selected wallet, live Arc | hidden or blocked before mutation | confirmed chain transaction plus receipt |
| Support a person | verified person, active payout destination, selected wallet, live Arc | hidden or invitation path | confirmed chain transaction plus receipt |
| Execute allocation | explicit execute request, treasury gate, live Arc | 503 or pending Mission state | confirmed chain transactions |
| Global distribution | live Arc treasury gate | returns blocked, no authorization fulfillment | confirmed transaction list |
| Contributor transfer | live Arc | failed without tx hash | provider-confirmed tx hash |
| Nano payment | live Arc | failed without tx hash | provider-confirmed tx hash |

## Database migration integrity

Migration `20260729190531_product_integrity_schema_and_program_dedupe`:

- uses additive `IF NOT EXISTS` DDL
- creates missing tables and indexes
- restores foreign keys
- enables RLS
- revokes anon and authenticated Data API privileges
- quarantines duplicate program rows without deletion
- adds one active identity constraint
- quarantines a narrowly bounded, evidenced legacy unit bug
- does not create, settle, or confirm any financial record

## Failure and recovery behavior

- Discover source failures remain section-level and do not erase successful source results.
- Degraded Discover responses use `no-store`.
- The live settlement query is a single bounded query with a maximum of 24 rows.
- Workspace readiness preserves last successful data, marks it stale, and stores the failed resource.
- Arc-disabled execution fails before settlement success records are created.
- Legacy and incomplete records remain available for operators and audit.

## Claims that must not be made

Until production evidence changes, the product must not claim:

- confirmed public funding above zero
- a successful Arc settlement
- a reconciled Circle transfer
- a public receipt
- a payout-ready direct-support recipient
- an active public Pool
- a complete contributor claim
- a released DeputyEscrow outcome
- a completed repeat funding cycle

## Required follow-up before financial activation

1. Complete ERC-8183 testnet checks.
2. Enable the live feature flag only after the checks pass.
3. Create or verify canonical `Wallet` and `PayoutDestination` rows.
4. Complete operator program publication metadata.
5. Activate a policy and treasury destination.
6. Run an explicit user-approved preflight.
7. Submit one real Arc Testnet USDC transaction.
8. Reconcile it into `ChainTransaction`.
9. Issue one `Receipt`.
10. Verify the receipt against Arcscan and Circle.
