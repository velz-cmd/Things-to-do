# RESOLVE full product repair audit

Audit date: 2026-08-01

Production: `https://resolve-self.vercel.app`

Starting commit: `c2a5cc14f6c7f385e1b097e95ae4d02e2f364e65`

## Chosen recovery slice

The user is a contributor, funder, or community operator who needs to see real economic state and the next valid action without reading false financial claims. The highest-risk failure was Discover hiding every genuine entity because money was not ready. The recovery therefore follows the real product loop already present in the repository:

GitHub or operator state to evidence or blocker to Mission or Communities setup to Capital only when executable to confirmed receipt and Earn.

## Capability audit

| Capability | Existing implementation | Production defect | Repair in this change | Active state after repair |
| --- | --- | --- | --- | --- |
| GitHub personal OAuth | Supabase user fields and source connection | Other tabs could still show generic connection actions | Read from workspace readiness and real GitHub-linked users | Shared identity state |
| GitHub App | source connection, install flow, repository snapshots | My Communities did not project it | Reused in account-scoped community read model | Connected, stale-aware |
| Repository sync | OSS scan store and immutable snapshots | Snapshot existed but Discover marketplace ignored activity | Added snapshot-to-work projection for supported accepted records | Active when records exist |
| Evidence | canonical `Evidence` plus snapshot activity | Production canonical evidence count is zero | Uses evidence-grade snapshot records without inventing work | Gated by real accepted activity |
| People | user and contributor identity models | Legacy verified flag mixed real and demo identities | Projects GitHub-ID users with active operator state, exact payout blocker | Active inspection, support gated |
| Communities | 17 user-owned installs | Discover replaced state with a generic link | Restored My Communities view from signed-in canonical state | Active |
| Programs | 25 active records | strict new metadata hid every record | Restores 11 GitHub-backed operator programs, backfills provenance and lifecycle metadata | Active operator entities |
| Pools | program projection and funding handoff | publication and money readiness were one gate | Zero-balance real Pools remain visible, setup action replaces fund action | Active setup, funding gated |
| Mission | persisted sessions and structured artifacts | context was not offered from recovered work and Pool blockers | Work projection carries Mission design-policy context | Active handoff |
| Capital | wallet, authorization, settlement, reconciliation models | generic funding links could appear without prerequisites | Capital handoff only when Pool or person execution is ready | Gated by real package |
| Earn | authorization, claim, payout and receipt reads | source identity could be asked to reconnect | Uses shared readiness and verified payout destination rule | Active read, settlement gated |
| Profile | identity, connection, wallet and payout management | Discover did not use canonical completion state | Payout and GitHub setup actions return to the exact Discover view | Active control plane |
| Outcomes | live settlement and receipt query | campaign state could be confused with an outcome | Outcomes projection accepts confirmed receipt plus Arc transaction only | Correctly empty in baseline |
| Provider resilience | Redis stale cache and section fallbacks | cached `v2` empty results survived the filter regression | New cache namespace and resource-scoped failures | Active |

## Financial integrity retained

Production currently has 111 payment authorizations, 23 active or target-met stake rows, and no funding intent, settlement batch, chain transaction, or receipt. These records remain classified as obligation or legacy ledger state. The repair does not call them paid, funded, settled, or confirmed.

Direct support, Pool deposit, Pool distribution, verified-work reward, claim, escrow release, fee settlement, reconciliation, and receipt verification remain behind their existing deterministic preflight and explicit user approval. This change connects their valid setup and review paths but does not execute money automatically.

## Migration and backfill

Migration `20260801100354_discover_entity_financial_separation`:

- quarantines ten exact legacy demo contributor seeds without deleting rows
- attaches canonical owner and install IDs to active GitHub programs
- records `operator_created` provenance when missing
- records the truthful `legacy_active`, `legacy_configured`, and `setup_required` states
- marks unavailable-adapter programs for operator review
- does not create a balance, payout, transaction, confirmation, or receipt

## Definition of done for release

- Discover renders genuine People, Pools, and My Communities from persisted state.
- Verified Work remains honest when the current repository snapshot has zero accepted records.
- For You contains real operator, contributor, or funder actions when canonical blockers exist.
- Unsupported adapters and demo seeds do not appear as active public entities.
- Financial buttons appear only when their exact preconditions are met.
- Static checks, unit and lifecycle tests, action audits, Playwright, production build, migration verification, CI, and production browser checks pass.

