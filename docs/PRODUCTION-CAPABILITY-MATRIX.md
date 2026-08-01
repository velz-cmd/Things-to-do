# RESOLVE production capability matrix

Audit date: 2026-08-01

Status meanings:

- Active: production data and the complete required path exist.
- Recovered: a real entity is restored with accurate setup state.
- Gated: the implementation exists, but a required production precondition is missing.
- Operator-only: the record remains available to its owner and is not offered as a public or financial action.
- Confirmed-empty: the authoritative production tables contain no eligible result.

| Capability | Canonical state and execution | Production evidence before recovery | Repair and test | Final state |
| --- | --- | --- | --- | --- |
| Authentication | Supabase session and `User` | 5 users | Existing session loaders retained | Active |
| Personal GitHub identity | `User.githubId`, `User.githubUsername`, `SourceConnection(provider=github)` | 3 real GitHub-linked operators, 1 connected source | Shared across Profile, Discover, Earn, and Communities | Active |
| GitHub App access | `SourceConnection(provider=github_app)` and repository snapshots | 1 connected source, 2 snapshots | My Communities reads the persisted installation state without another OAuth prompt | Active, stale-aware |
| Repository synchronization | GitHub App snapshots and OSS scan store | 2 snapshots and 1 scan for one repository | Persisted data renders first. Live providers are not called by the page loader | Active |
| Discover canonical read model | Programs, users, installs, repository evidence, confirmed settlements | All six views returned zero | One server read model now projects For You, People, Verified Work, Pools, Outcomes, and My Communities | Recovered |
| For You action inbox | Deterministic role and blocker projection | No useful result | Produces setup, sync, identity, authorization, and confirmation actions from persisted state | Recovered |
| People | Real GitHub-linked `User` records plus verified `PayoutDestination` readiness | 3 genuine GitHub operators were hidden among 13 legacy registry results | Excludes exact seed identities and keeps payout-incomplete people visible | Recovered, 3 people |
| Direct support | Verified payout destination, live Arc execution, confirmation, receipt | 0 verified payout destinations, 0 receipts | Support action stays disabled and the exact payout blocker is shown | Gated |
| Verified Work | Accepted GitHub activity records with a GitHub source URL | 2 snapshots and 1 scan, but 0 accepted activity records | Supports merged code, reviews, documentation, and releases when persisted evidence exists | Confirmed-empty with a repository-sync action |
| Work reward | Evidence to policy to obligation to Capital | 0 canonical evidence and 0 obligations | No amount is invented. Mission can design a funding rule once work exists | Gated |
| My Communities | `ResolveCommunityInstall`, programs, source connection, repositories | 17 active installs across 7 communities | Signed-in account projection restores communities, repositories, programs, Pools, source health, and blockers | Recovered |
| Programs | `ResolveProgram` under an active install and Mission | 25 active programs | Valid ownership and provenance are backfilled without rewriting IDs | Active for operators |
| GitHub-backed Pools | Real active program, active install, GitHub-linked owner, supported connector | 11 valid programs were hidden by financial-publication checks | Entity visibility is separated from funding readiness | Recovered, 11 setup-incomplete Pools |
| Unsupported adapter programs | Navidrome, Jellyfin, OpenAlex, Crossref, OpenCollective program records | 14 active programs | Kept private to operators with `blocked_unsupported_adapter` metadata | Operator-only |
| Pool deposit | Exact Pool, treasury, policy, live Arc, user approval, transaction, receipt | Legacy stake ledgers exist, 0 authoritative funding intents or transactions | Legacy ledgers are labelled pending and never counted as confirmed balance | Gated |
| Pool distribution | Obligations, authorization, settlement batch, chain transaction, receipt | 111 authorization rows, 0 settlement batches and 0 chain transactions | Authorization remains an obligation state and never becomes a payment claim | Gated |
| Contributor claim | Claimable obligation, verified identity and payout, live settlement | 0 canonical payout destinations and 0 pending rewards | Existing controls remain behind readiness checks | Gated |
| Outcome and milestone escrow | Approved policy, funded intent, settlement, receipt | 0 production outcome campaigns and no confirmed transaction | No synthetic outcome is created | Confirmed-empty |
| Outcomes feed | Confirmed `ChainTransaction` joined to a `Receipt` | 0 chain transactions and 0 receipts | Read model rejects incomplete settlement rows | Confirmed-empty |
| Mission | Missions, artifacts, structured actions | 1,179 Mission records | Discover handoffs carry repository, work, Pool, blocker, and return context | Active, artifact completion remains workflow-specific |
| Communities console | Installs, programs, policies, integration controls | 17 active installs, 48 total programs | Discover links to exact community and program setup surfaces | Active for supported GitHub workflows |
| Capital | Selected wallet, preflight, explicit approval, settlement lifecycle | Wallet configuration is present, live execution is gated, 0 authoritative transactions | Discover only links to Capital when financial readiness is true | Gated for money execution |
| Earn | Authorizations, payout readiness, confirmed receipts | 111 authorizations, 0 receipts | Amount and payment states remain authoritative and shared with Profile | Active for inspection, settlement gated |
| Profile | Identity, source connections, selected wallet, payout destination | GitHub identity is present, canonical payout destination is absent | Discover consumes Profile state instead of asking for duplicate connections | Active, payout setup required |
| Circle and Arc | Existing Circle client, Arc Testnet transfer and confirmation adapters | Environment health is configured, live execution gate is disabled | No transaction is submitted during recovery without explicit financial approval | Gated |
| Receipts and reconciliation | Confirmed transaction to receipt lifecycle | 0 confirmed transactions and 0 receipts | Outcomes require both authoritative records | Confirmed-empty |
| Action registry | `action-registry.ts` and generated manifest | Legacy controls include unregistered UI elements | Recovery uses only known action IDs. Audit reports 0 unknown IDs and 0 dead patterns | Active for recovered paths, broader legacy audit remains |

## Backfill result

The migration dry run completed inside a transaction and rolled back:

| Classification | Rows |
| --- | ---: |
| Exact repository demo contributors quarantined | 10 |
| Real GitHub-backed programs annotated for recovery | 11 |
| Unsupported-adapter programs marked operator-only | 14 |
| Financial records created | 0 |

## Financial truth at audit time

No supported production flow has an authoritative confirmed transaction and receipt pair. The recovery restores real entities and valid setup actions. It does not claim a payment occurred. Direct support, Pool deposits, distributions, work rewards, claims, escrow, fees, and reconciliation remain gated until their explicit production preconditions and human approval exist.
