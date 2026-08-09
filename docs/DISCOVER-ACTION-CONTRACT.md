# Discover action contract

Every Discover action uses a registered `ResolveActionId`, a typed presentation target, and a specific persisted subject. Buttons are generated from current entity state and capability checks, not from assistant prose.

## Shared contract

| Field | Requirement |
| --- | --- |
| Action ID | A value from `RESOLVE_ACTION_IDS` |
| Subject | Stable canonical entity identifier |
| Context | Current Discover query, intent, view, repository, and community |
| Presentation | `workbench` with a discriminated panel, or secondary `navigation` |
| Preconditions | Session, ownership, identity, payout, wallet, policy, treasury, or evidence as required |
| Validation | Zod at HTTP boundaries and typed discriminated unions in UI code |
| Idempotency | Required before financial or external side effects |
| Lifecycle | Validating, submitting, pending external, confirmed, rejected, or sync failed |
| Recovery | Preserve submitted identifiers and retry only the safe incomplete step |
| Audit | `ActionRun` plus the operation's canonical domain records and operational event |
| Confirmation | Required before money movement or a public lifecycle change |

## Workbench operations

| Panel | Registered operation | Owner service | Preconditions | Persistence or external effect | Recovery artifact |
| --- | --- | --- | --- | --- | --- |
| Evidence | `discover.open_evidence` | Discover | Persisted source record | Read only | Source URL and evidence IDs |
| Payout destination | `profile.set_payout_destination` | Profile | Signed-in current user | `PayoutDestination` | Verified destination state |
| Direct support | `capital.open_funding` | Wallet and settlement | Signed in, verified other recipient, explicit wallet, balance, live Arc | Arc USDC transfer, `SettlementBatch`, `ChainTransaction`, `Receipt`, `ActionRun` | Transaction hash and receipt |
| Pool funding | `capital.open_funding` | Capital | Signed in, exact program, active policy, treasury, explicit wallet, balance | Existing funding and settlement pipeline | Funding progress and receipt |
| Program create | `program.create_draft` | Communities | Owner or operator, existing community | `ResolveProgram` draft | Program ID |
| Program publication | `community.open` | Communities | Owned persisted program | Whitelisted publication metadata | Program state |
| Program policy | `program.update_policy` | Communities | Owned persisted program, valid rules | Versioned rules and policy metadata | Program state and audit event |
| Program treasury | `community.open` | Communities | Owned persisted program, valid Arc address | Whitelisted treasury metadata | Program state |
| Source sync | `source.sync` | Profile and GitHub adapter | Signed in and connected identity | Persisted source refresh | Provider status and last successful snapshot |
| Authorization review | `capital.review_authorization` | Capital | Signed in, persisted package | Read only in Discover | Exact missing evidence or payout prerequisite |
| Receipt | `receipt.open` | Capital | Confirmed canonical receipt | Read only | Receipt and ArcScan URL |

Canonical `Receipt` records open at `/outcomes/[publicReference]`. The legacy `/receipt/[id]` renderer belongs to older earning and payout models and must not be used for canonical Discover outcomes.

## Direct-support idempotency

1. The client creates one UUID when the workbench opens.
2. The server creates or reuses the corresponding `ActionRun` before an app-wallet transfer.
3. Circle receives a deterministic UUID derived from the same operation key.
4. A completed run returns its existing receipt.
5. A concurrent or pending duplicate returns `202` and does not transfer again.
6. An external-wallet retry reuses the confirmed transaction hash and only retries verification and receipt persistence.

## Invalid operations

- Direct support to the sender's own payout address
- Financial execution without an explicit funding source
- Pool funding without an exact program ID
- Treating a target, proposal, pending deposit, or submitted transaction as confirmed funding
- Activating a program from a generic review action
- Converting provider timeout into an empty canonical data set
