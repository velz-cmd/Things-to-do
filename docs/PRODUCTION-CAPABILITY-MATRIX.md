# RESOLVE production capability matrix

Status meanings:

- Active: supported and production-safe
- Repaired: supported path fixed in this change
- Gated: implementation exists, but a required production precondition is missing
- Hidden: not shown as executable
- Audit-only: records remain visible to operators, not treated as execution

| Capability | Models and state | Routes or execution | UI owner | Production evidence | Status | Required next work |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication | Supabase user and session | auth callbacks and session loaders | shared shell, Profile | 5 users | Active | Continue provider monitoring |
| Personal GitHub OAuth | user GitHub fields, `SourceConnection` | connect and callback routes | Profile, Discover, Earn | 1 connected source | Active | Refresh stale readiness on demand |
| GitHub App installation | `SourceConnection`, install records, snapshots | GitHub App install and callback | Profile, Communities, Discover | 1 connected source | Active | Maintain signed webhook and permission checks |
| Repository synchronization | repository snapshots and OSS scan cache | sync and scan routes | Discover, Communities | 2 snapshots, 1 scan | Active | Publish canonical evidence records |
| Shared workspace readiness | `WorkspaceReadinessSnapshot` | readiness loaders and retry | all tabs | 1 snapshot, stale failure retained | Active | Add dedicated confirmed balance snapshot provenance |
| Public Discover views | canonical marketplace query | `/api/discover/opportunities` | Discover | view bug reproduced | Repaired | Keep view contract tests |
| People discovery | `ContributorRegistry` | people loader | Discover | 13 verified people | Active for inspection | Canonical payout readiness before support |
| Direct support | payout, wallet, funding intent, chain tx, receipt | Capital preflight and transfer adapters | Discover, Capital, Earn | 0 payout destinations, 0 receipts | Hidden | Create verified payout destination and enable live Arc |
| Verified work discovery | snapshots, future canonical evidence | marketplace work view | Discover | source snapshots exist, 0 public canonical opportunities | Active for inspection when published | Publish evidence-backed work records |
| Verified-work reward | evidence, obligation, funding intent, settlement | Mission and Capital | Discover, Mission, Earn | 0 canonical evidence and obligations | Gated | Build canonical evidence-to-obligation data |
| Communities | install, ecosystem, roles | community APIs | Communities | 17 installs | Active | Consolidate operator publication controls |
| Program operation | `ResolveProgram`, rules, versions | program CRUD and deployment | Communities | 48 legacy programs | Active for operator use | Migrate active policies into versioned models |
| Pool publication | program metadata, policy, treasury | marketplace publication query | Communities, Discover | no record meets publication contract | Hidden | Approve provenance, version, policy, and treasury |
| Pool deposit | stake ledger, wallet tx, future chain tx and receipt | Capital funding handlers | Communities, Discover, Capital | 23 legacy stake rows, no authoritative tx | Hidden | Enable live Arc and reconcile deposit |
| Pool distribution | authorizations, settlement batch, chain tx, receipt | deploy and global settlement | Communities, Capital, Earn | 98 authorized, 0 confirmed | Gated | Live treasury, recipients, policy, confirmation |
| Platform fee | configured fee split | payment planner | Capital | code present, no confirmed tx | Gated | Verify fee address and real settlement |
| Contributor claim | pending reward, payout destination, chain tx, receipt | claim routes | Earn, Capital, Profile | 3 claimable authorizations, 0 payout destinations | Gated | Identity and payout verification |
| Outcome campaign | campaign, work submission, snapshots, funding intent | outcome APIs | Discover, Mission, Earn | 0 production campaigns | Hidden | Create a real owned asset and funded policy |
| DeputyEscrow outcome | `Settlement`, task proof, contract adapter | escrow routes | Mission, Capital | 1 failed settlement, no tx hash | Gated | Complete testnet checks and user-approved funding |
| Circle developer wallet | existing wallet configuration | Circle SDK and Arc memo transfer | Capital | env health configured, execution flag disabled | Gated | Enable only after ERC-8183 checks |
| Connected external wallet | user selected wallet fields | Reown and tx verification | Profile, Capital | 3 connected addresses in legacy user state | Active for selection | Migrate into canonical `Wallet` rows |
| Account-associated app wallet | user wallet fields, Circle IDs | wallet loaders | Profile, Capital | 4 app wallet addresses | Active for display | Migrate into canonical `Wallet` rows |
| Balance snapshot | user ledger and live Arc rail | readiness and Capital loaders | account menu, Capital | reasonable current user totals, stale readiness failure | Active with limitation | Persist an explicit provider-confirmed snapshot |
| Authorizations | `PaymentAuthorization` | ledger APIs | Earn, Capital | 111 rows | Active as obligation state | Never label as payment |
| Mission investigation | Mission, turns, artifacts, action runs | structured Mission API | Mission | 1,178 missions, 8 artifacts | Active | Improve artifact conversion into canonical policies |
| Mission to execution | blueprint, simulation, funding intent, settlement | Mission actions and Capital handoff | Mission, Capital | structured actions exist, lifecycle tables empty | Gated | Persist approved versions and funding intents |
| Reconciliation | chain transaction and receipt lifecycle | settlement status jobs | Capital | 0 chain transactions | Gated | First real submission required |
| Public receipts | `Receipt`, legacy receipt routes | receipt APIs and pages | Discover, Earn, Capital | 0 authoritative receipts | Hidden | Issue only after confirmed chain transaction |
| Live settlement feed | receipt joined to confirmed chain tx | `/api/discover/live-settlements` | Discover | old endpoint timed out | Repaired | Monitor query duration after deploy |
| Automation rules | `ResolveAutomationRule` | automation services | Communities | table missing before migration | Gated | Apply migration, then test rule lifecycle |
| Distribution audit | `DistributionBatch`, `DistributionEvent` | treasury distribution services | Communities, Capital | tables missing before migration | Gated | Apply migration and connect to confirmed lifecycle |
| Mission blueprint receipt | `MissionBlueprintReceipt` | Mission blueprint services | Mission | table missing before migration | Gated | Apply migration and test cross-device persistence |
| Action registry | action definitions and generated manifest | `audit:actions` | all tabs | 969 controls, 131 registered | Audit-only | Register the remaining 838 controls by workflow priority |

## Production financial results at audit time

| Flow | Result | Transaction reference | Circle reference | Receipt | Earn record |
| --- | --- | --- | --- | --- | --- |
| Direct support | Blocked, no payout destination | None | None | None | None |
| Pool deposit | Legacy stake ledger only, not confirmed | None | None | None | None |
| Pool distribution | Authorized obligations only | None | None | None | Authorization rows only |
| Verified work | Source scan state only | None | None | None | None |
| Contributor claim | Claimable state only | None | None | None | 3 claimable authorizations |
| Outcome escrow | One failed legacy settlement | None | None | None | None |

These empty references are intentional and accurate. No real payment was executed during this repair because no user approved a transaction and the live Arc gate is disabled.
