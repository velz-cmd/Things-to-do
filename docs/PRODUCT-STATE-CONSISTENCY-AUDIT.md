# Product State Consistency Audit

Date: 2026-07-29

Scope: Profile, Discover, Earn, Capital, the account menu, shared source state, wallet state, and persisted read models.

## Product promise

RESOLVE turns verified digital work into fundable opportunities and carries each funding path to a confirmed receipt.

## Confirmed production causes

Production has legacy GitHub and wallet fields on `User`, two persisted `SourceConnection` rows, no normalized `Identity`, `Wallet`, `PayoutDestination`, or published `DiscoverOpportunity` rows, and 26 active `ResolveProgram` rows. The Prisma schema declares `UserEarningsSnapshot` and `CommunityVitalsSnapshot`, but the deployed database does not contain those tables. Queries against both tables fail repeatedly. Broad bootstrap queries then exceed page timeouts and replace valid legacy state with empty fallback payloads.

The canonical correction is a server-owned `WorkspaceReadinessSnapshot`. It derives state only from persisted RESOLVE records, never calls GitHub, Circle, Arc RPC, or AI during page rendering, and retains its previous confirmed payload when refresh fails.

## Contradictions and corrections

| Contradiction | Current source of truth | Competing source | Route or query | Failure condition | Existing fallback | Correct canonical state | Required fix | Proving test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Profile says GitHub is connected while Earn asks to verify it | `User.githubUsername` and `SourceConnection(provider=github)` | `Identity(status=verified)` only | `/profile`, `/earn`, `POST /api/outcomes/identity` | No normalized `Identity` row exists | Earn renders “Verify GitHub” | `connected` identity with a separate payout-readiness state | Read GitHub readiness from the shared snapshot, then offer canonicalization only when needed | Connected GitHub is identical in Profile, Discover, and Earn |
| Profile says repository access is installed while Discover cannot evaluate it | `SourceConnection(provider=github_app)` and community installs | Discover program source request | `/api/profile/state`, `loadDiscoverPageData` | Cold database query exceeds source timeout | Discover drops the source and can show zero results | Installed access remains `connected`; repository sync has its own state and timestamp | Persist shared installation readiness and serve the last good public opportunity cache | Repository installation remains visible during a program-source timeout |
| Account menu shows a wallet while Capital says no wallet exists | Legacy `User.walletAddress`, `scanWalletAddress`, and `selectedCapitalWallet` | Normalized `Wallet` plus the Capital bootstrap deadline | shell profile state and `/capital` | Capital bootstrap exceeds seven seconds or normalized rows are absent | A newly derived embedded address with all balances unknown | The selected legacy-backed wallet remains visible with exact freshness and no invented zero balance | Use the shared snapshot in the Capital fallback and preserve last confirmed balance | Account menu and Capital expose the same selected address and readiness |
| Profile reports four sources while another tab reports none | Legacy profile fields plus `SourceConnection` | Per-page direct queries | `/api/profile/state`, `/earn`, `/discover` | One page times out or ignores legacy fields | Each page invents its own empty state | Every shared provider uses one explicit readiness state | Centralize state derivation and resource-specific refresh | A single fixture produces matching states on every consuming surface |
| Capital shows pending authorizations while financial source is unavailable | Persisted `PaymentAuthorization` and `SettlementBatch` | Live balance/RPC status | `loadCapitalBootstrap`, `loadCapitalState` | Balance refresh is slow or unavailable | Financial records remain while wallet context disappears | Authorizations stay persisted; wallet and balance freshness are independent | Preserve wallet identity and last-known balance while marking only balance refresh stale | Provider timeout preserves authorizations and confirmed wallet state |
| Discover shows no useful result after a source timeout | Active `ResolveProgram` and public marketplace records | One request-scoped source result | `listMarketplaceOpportunities` | Program query exceeds 7.5 seconds | Source is omitted from the page | Last confirmed public results remain available and marked stale | Use resilient shared caching around bounded source queries | Timeout returns cached public records and one exact failure |
| Community and earnings sections degrade across pages | Declared Prisma snapshot models | Missing production tables | community vitals and earnings aggregate queries | PostgreSQL relation does not exist | Individual queries catch errors, then parent bootstraps time out | Snapshot tables exist, remain server-only, and are refreshed normally | Add the missing migration with RLS and revoked Data API access | Prisma validation plus migration smoke query |
| Failed refresh turns unavailable data into zero | `User.availableUsd` and previous confirmed reads | empty bootstrap money objects | Profile and Capital fallbacks | Database or provider timeout | zero-valued summaries | Unknown stays `null`; confirmed values retain timestamp | Snapshot last confirmed values and update only failure metadata | Last-known-data preservation unit test |

## Canonical readiness states

Every shared resource uses one of:

- `not_configured`
- `connected`
- `syncing`
- `stale`
- `permission_missing`
- `sync_failed`
- `disconnected`
- `revoked`
- `unavailable`

Connection existence, synchronization health, payout readiness, and balance freshness are separate facts. A failed optional refresh does not erase a confirmed connection.

## Tab ownership

- Home explains the product loop.
- Discover finds public people, verified work, Pools, programs, and outcomes.
- Mission investigates and prepares decisions.
- Communities owns organization integrations, programs, Pools, and publication.
- Earn owns recognized work, earnings, payout blockers, settlements, and receipts for a recipient.
- Capital owns balances, funding authorization, settlement, reconciliation, and financial history.
- Profile owns personal identities, account connections, wallet selection, payout destinations, and security.

Discover may initiate a funding intent, but Capital remains the final financial authority.

## Discover to Capital Pool handoff

Published Pool actions pass the exact program ID and a safe Discover return path to
Capital. Capital filters its fundable-program read model to that program and requires
an explicit review before execution. The review identifies the Pool, amount, Arc
Testnet USDC asset, RESOLVE fee, confirmed and expected balances, and the active
distribution rule. The funder cannot edit recipient weights.

The funding panel uses a bounded public read, shows a resource-specific retry when
that read fails, disables duplicate submission while funding is in progress, and
keeps submitted and confirmed settlement states separate through the existing
Capital execution engine. Discover never receives settlement authority.

## Security and privacy

Readiness snapshots contain only server-selected account state. They do not contain provider tokens, private keys, full raw provider responses, or raw exception text. Snapshot tables have RLS enabled and direct `anon` and `authenticated` Data API access revoked. Public Discover queries return only explicitly public records or safe derived fields.
