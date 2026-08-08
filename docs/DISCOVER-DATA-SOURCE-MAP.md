# Discover data source map

Discover uses persisted models for the first render. External providers refresh or enrich those models and cannot replace valid persisted data with a zero-result response.

| Product entity | Canonical source | External source | Freshness signal | Failure behavior |
| --- | --- | --- | --- | --- |
| Person | `User`, `Identity`, `PayoutDestination`, community roles | GitHub OAuth identity | User update, verified payout time | Keep persisted person and label the source stale |
| Verified Work | `Evidence`, repository snapshot and accepted-activity records | GitHub App repository access | Snapshot scan and last successful sync | Keep accepted persisted work, show exact provider failure |
| Pool | `ResolveProgram`, community and funding records | None required for initial render | Program, policy, treasury, and funding timestamps | Keep Pool, expose the precise setup blocker |
| Program | `ResolveProgram`, versioned rules and whitelisted setup metadata | GitHub source when configured | Program update and source sync | Keep program, separate source failure from policy state |
| Community | `CommunityInstall`, community roles, programs, repositories | GitHub App installation | Installation and repository sync | Keep installed community, expose repository status separately |
| Funding authorization | Capital funding intent, obligations, evidence, payee readiness | Arc only after submission | Authorization update | Keep package and list missing prerequisites |
| Settlement | `SettlementBatch`, `ChainTransaction` | Circle wallet or connected Arc wallet | Submission and reconciliation timestamps | Preserve submitted transaction and retry reconciliation |
| Outcome | `Receipt` linked to confirmed transaction | ArcScan proof URL | Receipt creation and chain confirmation | No outcome until canonical receipt exists |
| User capability | Session, verified identities, wallet and community role | Wallet connection status | Current readiness snapshot | Disable or replace actions with an exact recovery reason |

## GitHub boundary

GitHub OAuth proves personal account identity. GitHub App installation grants repository access. These are different states. Public repository analysis is allowed without creating a community, program, Pool, policy, obligation, or funding record.

## Cache behavior

- Personal and public projections use separate keys.
- A successful mutation invalidates the related Discover, profile, community, capital, or receipt keys.
- Resilient cache reads may serve the last successful payload while reporting staleness.
- Empty is a valid result only when the persisted query succeeds and returns no supported records.
- Timeout, permission failure, provider error, and malformed provider payload are error states, not empty results.

## Dedupe key

Canonical entities dedupe by subject type and persisted subject ID. Legacy program projections also include community, repository, and normalized title when no stronger canonical identifier exists. The same record must not appear once as a program and again as a Pool unless two distinct canonical mechanisms exist.
