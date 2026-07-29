# RESOLVE full product activation audit

Audit date: 2026-07-29
Starting production commit: `3a0040711f1bcc6c46d89b617e48c66fdcc7ae90`
Production: `https://resolve-self.vercel.app`
Database project: `jjducnguljjddciczvuy`

## Scope and method

This audit inspected the current main branch, recent Git history, 285 API route files, the Prisma schema and migration history, 81 test files, environment-variable use, the action registry, production HTTP behavior, and production database state. Production database inspection used read-only SQL. Data correction is delivered as a reproducible migration. No manual production row edits are part of the repair.

The implementation reuses the existing RESOLVE architecture:

- Supabase Postgres with Prisma server access
- Supabase authentication
- persisted `WorkspaceReadinessSnapshot`
- personal GitHub OAuth and GitHub App installation state
- Circle developer-controlled client and provider wallets
- Arc Testnet and Arc USDC configuration
- connected external wallet support
- the existing Mission, program, authorization, settlement, and receipt models
- the existing DeputyEscrow and ERC-8183 feature gates
- the existing action registry and structured Mission response contract

## Confirmed production state before repair

| Area | Confirmed state |
| --- | --- |
| GitHub sources | One personal GitHub connection and one GitHub App connection, both marked connected |
| Repository evidence | 2 repository snapshots and 1 GitHub OSS scan cache record |
| Workspace readiness | 1 persisted snapshot, last refresh failure preserved as stale state |
| Communities | 17 installs |
| Programs | 48 records, including repeated template names across communities |
| Program stake ledger | 23 rows, 21 active and 2 target-met, with $256 recorded principal |
| Authorizations | 111 rows, 98 authorized, 10 pending funding, 3 claimable |
| Authoritative settlement lifecycle | 0 `FundingIntent`, 0 `SettlementBatch`, 0 `ChainTransaction`, 0 `Receipt` |
| Legacy settlement | 1 failed `live_arc` row with no transaction hash |
| Payout readiness | 0 canonical `PayoutDestination` rows |
| Canonical wallets | 0 canonical `Wallet` rows, while legacy user wallet fields remain populated |
| Evidence lifecycle | 0 canonical `Evidence`, `Identity`, `ProgramVersion`, `PolicyVersion`, or `Obligation` rows |
| Discover publication | 0 canonical public `DiscoverOpportunity` rows |
| Public people source | 13 verified contributor registry rows, all with a registry wallet |
| Mission | 1,178 missions, 8 structured artifacts |
| Action runs | 21 records across Mission, Profile sync, and wallet selection actions |

## Critical findings and implemented decisions

### 1. Discover selected-view failure

The public opportunities API ignored `view`. `work`, `pools`, and other views returned the same default result set.

Repair:

- Parse the requested view in `/api/discover/opportunities`.
- Pass the view through the canonical marketplace query.
- Preserve legacy URLs by mapping `programs` to `pools` and old community views to `for_you`.
- Keep the public primary views to For You, People, Verified Work, Pools, and Outcomes.
- Provide My Communities as a direct link to Communities.

### 2. Misleading confirmed funding

Discover summed `CommunityFundStake.principalUsd` and labeled it confirmed funding. Production has no confirmed `ChainTransaction` and no `Receipt`.

Repair:

- Confirmed settlement volume now comes only from `Receipt` rows joined to confirmed `ChainTransaction` rows with a transaction hash, confirmation time, sender, recipient, and amount.
- Program stake rows remain preserved, but their amount state is `provenance_unavailable`.
- Outcome commitments use `funding_reserved`.
- Cards use amount-state-specific labels.
- The live settlement endpoint now returns only confirmed receipt and chain-transaction pairs.

### 3. Database-only payment success

The contributor and nano-payment executors marked transfers settled when Arc was disabled and generated `offchain-*` transaction-like values. The treasury gate also returned success in off-chain mode.

Repair:

- Arc-disabled contributor transfers fail without a transaction hash.
- Arc-disabled nano payments fail without a transaction hash.
- The treasury gate returns blocked when live Arc is unavailable.
- Mission and allocation execution recover to a pending or preview state.
- Global settlement does not fulfill authorizations when financial execution is blocked.
- Direct settlement records use `READY` before execution and no fabricated escrow hash.
- Claim-only preparation remains distinct from settled money.

### 4. Public Pool preconditions

Active template records were published as Pools without operator publication approval, explicit provenance, an active policy, a treasury address, or a publication version.

Repair:

A public program Pool now requires:

- `status` active or deployed
- a Mission scope
- `publicationStatus: approved`
- provenance of `external_user`, `external_integration`, or `operator_created`
- `policyStatus: active`
- a valid 20-byte treasury address
- a publication version
- a supported template or a valid repository reference
- no fixture, demo, or private marker

Existing production programs do not meet that contract, so they are hidden from public Discover until an operator completes real setup.

### 5. Duplicate programs and legacy unit corruption

Production contained one duplicate operational program identity under the canonical key `(installId, templateId, lower(name))`.

Production also contained 127 `sync:onchain` wallet rows from 2026-07-05 through 2026-07-06 where micro-USDC values were stored as USD. Their absolute displayed total was $250,963,120.

Repair migration:

- Selects the canonical program deterministically, preferring attached stake, settlement reference, and recent update.
- Marks duplicate rows `archived_duplicate`.
- Preserves their previous metadata in a quarantine record.
- Adds a partial unique index for active and deployed program identities.
- Marks the 127 bad wallet rows `quarantined_legacy_unit_error`.
- Excludes quarantined rows from Capital and wallet activity read models.
- Preserves every row for audit.

### 6. Production schema drift

Four Prisma models were absent from production:

- `ResolveAutomationRule`
- `MissionBlueprintReceipt`
- `DistributionBatch`
- `DistributionEvent`

The additive migration restores these tables, indexes, foreign keys, row-level security, and restricted Data API privileges.

## Shared workspace state

The existing persisted readiness model is retained. It already supports:

- explicit connection states
- GitHub personal and repository access state
- GitHub App installation state
- selected app or connected wallet
- payout readiness
- communities and programs
- pending authorizations and claims
- last successful timestamp
- stale-state preservation with a resource-specific failure

Known limitation:

`lastConfirmedBalanceMicroUsdc` is currently derived from the user ledger balance and profile update time. It is not a dedicated Arc confirmation snapshot. The field is treated as persisted account state and must not be used as proof of an onchain transaction. Capital's live Arc rail remains the authority for spendable onchain balance.

## Tab ownership after audit

| Tab | Canonical purpose | Current disposition |
| --- | --- | --- |
| Home | Explain the economic loop and route to supported work | Active |
| Discover | Inspect real people, verified work, approved Pools, and confirmed outcomes | Repaired, unsupported funding actions hidden |
| Mission | Investigate evidence and create persisted decision artifacts | Active, 8 artifacts confirmed |
| Communities | Operate installs, programs, policies, and Pool setup | Active, publication remains gated |
| Earn | Show authorizations, claimable work, submitted payments, confirmed payments, and receipts | Active read model, no confirmed receipt exists |
| Capital | Own wallet selection, preflight, authorization, submission, reconciliation, and receipts | Active, financial execution blocked while Arc is disabled |
| Profile | Own identity, GitHub, wallets, payout setup, permissions, and recovery | Active |

## Required environment groups

| Capability | Required variables |
| --- | --- |
| Database | `DATABASE_URL`, `DIRECT_URL` where migrations need a direct connection |
| Supabase auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server service-role key |
| GitHub OAuth | Supabase GitHub provider configuration |
| GitHub App | `GITHUB_APP_ID`, app slug, private key, install URL, webhook secret where used |
| Arc reads | `ARC_RPC_URL` or testnet RPC fallback, `ARC_CHAIN_ID`, `ARC_USDC_CONTRACT` |
| Circle wallets | `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`, client and provider wallet IDs and addresses |
| Live settlement | all Circle and Arc values plus `ARC_ERC8183_ENABLED=true` after testnet checks |
| Connected wallet | `NEXT_PUBLIC_REOWN_PROJECT_ID` and Arc public network configuration |
| Escrow | `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS`, oracle key, and a verified live contract path |
| Caching | Upstash Redis URL and tokens |

No secret value is included in this audit.

## Verification contract

The following statements are enforced:

- authorized is not settled
- claimable is not confirmed
- submitted is not confirmed
- a ledger stake is not confirmed funding
- no transaction hash may be synthesized
- no receipt may exist without a chain transaction reference
- provider failure must not erase the last confirmed readiness snapshot
- financial execution requires an explicit live Arc gate and human approval

## Remaining external blockers

- ERC-8183 production settlement remains disabled pending its testnet capability checks.
- There is no canonical payout destination in production.
- There are no confirmed lifecycle chain transactions or receipts.
- Existing programs lack the newly required public publication contract.
- Canonical evidence, identity, policy, obligation, funding-intent, and settlement-batch tables have no production records.
- Arcscan and Circle reconciliation cannot be reported until a user approves a real supported transaction after the feature gate is enabled.
