# Capital and Profile implementation audit

Audit date: 2026-07-18
Implementation branch: `codex/capital-profile-production`

This document records the repository state before the Capital and Profile production rebuild. It is an implementation baseline, not a completion report.

## Repository and history state

- Remote `main` was fetched at `5caad92`. That commit added one empty file whose name was an absolute Windows path and could not be checked out on Windows. The task branch contains a narrow hygiene commit that removes only that malformed path while preserving the `5caad92` parent and the unchanged application tree.
- The current `main` Capital/Profile implementation descends from the release line ending in `2cf6b69`, with later operating-system, outcome-campaign, and deployment-pipeline changes.
- Git objects contain an unmerged July 14–15 Capital/Profile implementation (`ae9b6a3` through `68655c2`). It includes Arc unit normalization, a provider router, Capital bootstrap/sync routes, a Capital command center, a consolidated Profile control-plane bootstrap, and lifecycle tests. Those commits forked before newer `main` work and must not be reverted or cherry-picked wholesale. Compatible ideas and isolated code will be recovered deliberately.
- Profile navigation previously existed in architecture and implementation history. Current `PRODUCT_NAV` exposes Home, Discover, Mission, Communities, Earn, and Capital, but not Profile.

## Current route chains

### Capital

```text
/capital
→ src/app/(shell)/capital/page.tsx
→ src/app/(shell)/payments/payments-page-client.tsx
→ PaymentsOS (767-line client component)
→ ResolveBanking (1,073-line client component)
```

Context parameters already parsed by `PaymentsOS` and therefore must be preserved:

- `missionReport`
- `program`
- `community`
- `fundingIntent`
- `settlementBatch`
- `returnTo`

### Profile

```text
/profile
→ src/app/(shell)/profile/page.tsx
→ ProfileShell
→ ProfileBootstrapProvider
→ ProfileSettings (848-line client component)
→ ProfileWorkServer
→ ProfileContributorIdentity (440-line client component)
```

The route also renders `ProfileReturnBanner`, which preserves a `next` route for Community connection workflows.

## Navigation state and Profile conflict

- `src/components/resolve/layout/nav.ts` defines no Profile entry.
- `src/components/resolve/layout/app-top-nav.tsx` still imports and calls `prefetchProfileTab`, but the callback is unreachable because no `/profile` item is present.
- `/profile`, Profile APIs, Profile React Query keys, session snapshots, connection warmup, and cross-tab links remain active.
- Earn is a distinct contributor/creator economic workspace and must remain in navigation.
- Profile must be restored without removing Earn or changing the marketing navigation.
- The current product nav is horizontally scrollable and already supports icon-only presentation below `md`; adding Profile should preserve keyboard labels and narrow-width usability.

## Existing working Capital behavior to preserve

- Canonical persisted application wallet resolution from `User.walletAddress`, with external linked wallet from `User.scanWalletAddress`.
- App and external wallet slices in `/api/capital/state`.
- Arc Testnet chain metadata and ArcScan links.
- Cached fast state and explicit live refresh state.
- Program funding, funding-intent handoff, Mission return path, Community settlement-package handoff, and settlement submission.
- Pending funding finalization, connected-wallet funding, claim execution, optimistic fund activity, transaction rows, settlement truth, and receipt links.
- Confirmed/pending/partial settlement distinctions in the existing settlement and operating-system models.
- Add-funds and send-funds dialogs supplied by the shared providers.

## Existing working Profile behavior to preserve

- Authenticated account identity from Supabase.
- Fast persisted connector identity state for GitHub, ListenBrainz, Navidrome, Jellyfin, Gmail, and wallets.
- Shared `UserConnectionsProvider`, session snapshot hydration, and cross-tab refresh events.
- OAuth return signals and Community `next` return path.
- GitHub, Gmail, ListenBrainz, Jellyfin, and Navidrome connect/disconnect behavior.
- Optional external wallet linking without replacing the application wallet.
- MusicBrainz artist and alias ownership flows.
- Server-rendered connected eligible work and links to Communities, Earn/claim, and Capital.

## Canonical backend sources of truth

| Concern | Current authoritative records/services | Notes |
|---|---|---|
| Authenticated account | Supabase session + `User` | `User` is keyed by Supabase user ID. |
| App wallet | `User.walletAddress`, Circle wallet provider metadata | Deterministic fallback exists but must not be presented as a persisted wallet when provisioning failed. |
| External wallet | `User.scanWalletAddress` | Wagmi connection is not a persisted identity by itself. |
| Wallet inventory | `Wallet` plus legacy `User` wallet fields | Operating-system migration exists; UI still primarily reads legacy fields. |
| Payout destination | `PayoutDestination` | Model and migration exist; current Profile UI does not expose the canonical record well. |
| Connection state | persisted `User` connector fields, `SourceConnection`, `getUserConnectionState` | The UI still merges several projections. |
| Identity and claims | `Identity`, `ObservedIdentity`, `IdentityCandidate`, `IdentityResolution`, `IdentityClaim`, `ContributorRegistry` | Models and indexes exist in `20260713163000_operating_system_core`. |
| Connected work | evidence/authorization/earnings projections | Profile currently loads it independently through `ProfileWorkServer`. |
| Treasury snapshot | `/api/capital/state`, `User.availableUsd`, Arc RPC cache | `User.availableUsd` is an app-wallet snapshot, not a portfolio total. |
| Authorizations | `PaymentAuthorization`, `Obligation`, Mission/Community handoff records | Legacy and normalized ledgers coexist. |
| Funding | `FundingIntent`, `WalletTransaction`, program fund services | Exact micro-USDC exists on normalized intents. |
| Settlement | `SettlementBatch`, `ChainTransaction`, existing settlement services | Submission is not confirmation. |
| Receipts | `Receipt` plus existing public/ledger receipt routes | No new receipt model is required. |
| Activity/audit | `OperationalEvent`, `ActionRun`, wallet and ledger activity | Outcome and operating-system migrations exist. |

## Duplicate and conflicting state calculations

### Capital

- `WalletBalanceSync` globally calls `/api/capital/state?fast=1` on authenticated mount, starts a live `/api/capital/state` request after 400 ms, then polls fast every 45 seconds and live every 90 seconds on every route.
- `PaymentsOS` independently calls `/api/capital/state`, `/api/banking/account?light=1`, and `/api/payments/overview` on Capital mount, then polls Capital fast state every 60 seconds.
- `AuthProvider.refreshBalance`, `PaymentsOS`, and two duplicate React Query hooks all own independent projections of `/api/capital/state`.
- `ConnectedWalletSync` adds a separate 45-second wallet sync loop.
- `PendingAuthorizationsPanel` adds a 25-second polling loop.
- Browser Arc snapshots, `AuthProvider`, `PaymentsOS` refs, React Query, Redis/in-process cache, and `User.availableUsd` all retain overlapping balance state.
- `loadCapitalState` exposes combined app-plus-external totals at the top level while wallet slices expose per-wallet spendable amounts. `AuthProvider` can therefore label a combined value as available even when only one wallet is selected.
- The fast Capital path returns `spendableBalance` equal to the cached app balance before reserve deduction, while the app wallet slice deducts reserved value.

### Profile

- `ProfileBootstrapProvider` calls `/api/profile/bootstrap?fast=1`.
- `UserConnectionsProvider` independently calls `/api/profile/state?fast=1`.
- `ProfileSettings` additionally calls `/api/profile/identities`.
- `useResolveAccount` calls `/api/connectors/status` and `/api/account/wallets`.
- `ProfileWorkServer` separately loads the profile and eligible work.
- The current bootstrap contains earnings and Communities summaries even though detailed earnings belong to Earn and operational Community state belongs to Communities.
- `ProfileSettings` merges bootstrap identities, connection-state identities, identity API enrichment, account wallet state, Auth balance state, and component state. A slower response can still create avoidable flicker or duplicated work.
- Profile connection refresh broadly invalidates Profile bootstrap, Profile state, Communities, and Discover radar even for a single source.

## Slow and unnecessary initial work

- Capital can initiate two live Arc reads during one visit: the global 400 ms live refresh and the page-specific live request. Live timeouts reach 22 seconds in `AuthProvider` and 20 seconds in `PaymentsOS`.
- The old Arc reader fans requests to every configured RPC endpoint in parallel and performs native balance, ERC-20 diagnostic balance, and block reads.
- Capital loads full wallet state, banking metadata, overview, and pending authorization polling before its primary composition is stable.
- Profile loads bootstrap, connection state, identity enrichment, connector status, wallet inventory, and connected work in parallel from separate owners.
- Profile provider-specific forms and MusicBrainz search/link logic ship in the initial route bundle.
- No Capital or Profile route-specific structural `loading.tsx` exists in current `main`.

## Arc balance and SSR risks

- Arc native USDC (18 decimals) and ERC-20 USDC interface (6 decimals) are correctly compared with `Math.max` in the current reader, not added. The comment still incorrectly describes the result as native plus ERC-20.
- Values are converted to JavaScript numbers before UI and aggregation boundaries. New normalized operating-system values already use micro-USDC `bigint`; new financial calculations should remain exact.
- A cached fallback can be wrapped in an `ArcUsdcBalance` carrying a current timestamp and `source: "arc_rpc"`, which obscures provenance.
- Browser snapshots currently sum app and external values in `AuthProvider`; this can be useful as a portfolio total but must not be called selected-wallet spendable value.
- Reown, Wagmi, `window`, clipboard, and wallet-provider access are client-only today. New server shells must preserve those boundaries.
- `resolveUserWallet` can generate a deterministic fallback address when no persisted wallet exists. UI must distinguish provisioning/configuration failure from a real persisted wallet.

## Schema and migration status

- Normalized `Wallet`, `PayoutDestination`, `SourceConnection`, identity, claim, obligation, Blueprint, funding, settlement, chain transaction, receipt, operational event, outbox, webhook, and idempotency records are present in Prisma.
- `20260713163000_operating_system_core` creates and indexes those records.
- `20260714120000_outcome_campaigns` creates earnings-ledger and `ActionRun` records.
- No new model is required merely to build the requested UI.
- Legacy `Float` fields remain on `WalletTransaction`, `PaymentAuthorization`, programs, and contributor records. New exact amounts should use existing micro-USDC fields; legacy reads must be normalized at their boundary.
- Production database migration availability must be surfaced honestly by API error states; this implementation must not run a production migration.

## Dead, cosmetic, or misleading controls

- The generated action manifest reports 745 visible controls, only 68 with stable action IDs.
- Capital’s existing add, send, claim, refresh, wallet selection, receipt, retry, and tab controls are largely unregistered even when they call real handlers.
- Profile connect, disconnect, wallet, MusicBrainz, return, sign-out, and section controls are largely unregistered.
- Capital links “Connections” to `/settings`, although user wallet/payout/identity configuration belongs in Profile.
- Pending authorization links target the stale `?tab=programs` query, while the existing page only recognizes Overview and Activity.
- The educational `MoneyFlowExplainer` is mounted in Capital despite the frozen ownership rules.
- Several local-only toggles are legitimate disclosure/tab controls, but operational buttons need stable action IDs and test IDs.

## Handoff risks

- The current Capital chain parses all required Mission/Community parameters, but local tab replacement can discard query context if not rebuilt from the full URL parameter set.
- Missing funding-intent or settlement-package payloads show recovery copy and do not move funds; this behavior should be preserved.
- Profile OAuth completion currently replaces the URL with `/profile`, which can discard the original `next` route after refresh.
- Claim blockers need exact links back to the Profile wallet/payout or identity section with a `returnTo` value.
- Legacy links use both `section=` and `tab=` conventions. The rebuilt Profile should accept those aliases while using one canonical `view=` value.

## Reusable primitives and infrastructure

- Layout: `AppShell`, `AppTopNav`, `ProductNav`, `ResolveBackground`.
- UI: `Button`, `Panel`, `BlueGlowCard`, `Money`, shared focus/ring tokens.
- Wallet: add/send providers and modals, `WalletViewSelector`, `useActiveWalletView`, `useResolveAccount`, `useSpendableUsd`.
- Capital: state loader/cache/single-flight, funding execution, handoff queries, settlement truth, wallet health, receipt routes.
- Profile: bootstrap/state queries, connection provider/snapshot, merge helpers, connector routes, server work builder.
- Data: React Query client/keys, Upstash cache helpers, Prisma singleton, action registry, Sentry API reporting.

## Oversized/high-risk files

- `src/components/resolve/payments/resolve-banking.tsx` — 1,073 lines; mixes handoffs, wallet UI, history, technical details, claims, educational copy, and local navigation.
- `src/components/resolve/payments/payments-os.tsx` — 767 lines; owns duplicate network state and merging.
- `src/components/resolve/profile/profile-settings.tsx` — 848 lines; mixes account, OAuth handling, provider forms, wallets, balances, and connection cards.
- `src/components/resolve/profile/profile-contributor-identity.tsx` — 440 lines; provider-specific claims and searches in the initial bundle.
- `src/components/auth/auth-provider.tsx` — shared across the application; balance changes can regress every tab.
- `src/lib/capital/state.ts` — canonical response used by multiple tabs and fund flows.
- Settlement and funding routes — money movement, idempotency, and receipt truth must not be simplified for presentation.

## Implementation order

1. Restore Profile navigation and active state while preserving Earn and the marketing nav.
2. Introduce a server-friendly Profile shell backed by one consolidated persisted bootstrap.
3. Build identity header, readiness/attention, wallets and payout, grouped identities, connected work, claims, relationships, and account links without duplicating Earn or Capital.
4. Preserve provider-specific flows behind progressive client sections and retain last-known connection state on refresh failure.
5. Introduce a dedicated Capital shell while retaining funding-intent and settlement-package handlers.
6. Consolidate the initial Capital projection into a cached bootstrap and eliminate the page-level duplicate live sync path.
7. Build Treasury, Pending, Claims, and History with honest provenance and contextual drawers/links.
8. Register all visible Capital/Profile operational controls and remove stale/dead links.
9. Add route skeletons, responsive layouts, accessibility, and targeted invalidation.
10. Run focused tests, then TypeScript, lint, lifecycle/unit/API/Playwright checks, action audit, production build, and screenshot verification.

## Test strategy

- Navigation: Profile visible, Earn retained, active-state coverage, keyboard and narrow-width behavior.
- Profile API/unit: persisted bootstrap, connection merge monotonicity, payout destination, claim persistence, return-path normalization, source failure preservation.
- Profile UI/Playwright: signed-out state, identity/wallet/source/work sections, mobile layout, no wallet-global SSR error.
- Capital unit/API: per-wallet selection, reserve deduction, cached/live provenance, no native/ERC-20 double count, failed RPC preserves cached value, bootstrap does not require live RPC.
- Capital UI/Playwright: cached first render, handoff recovery, funding intent, settlement batch, submitted-versus-confirmed truth, receipt/explorer links, claim-to-Profile return path, history filters and mobile layout.
- Regression: existing lifecycle tests, Prisma validation, action audit, TypeScript, lint, production build.
