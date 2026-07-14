# Capital and Profile implementation audit

Audit date: 2026-07-14
Branch: `codex/post-release-hardening`

This document records the implementation found before the Capital/Profile rewrite. It is an implementation inventory, not a completion report.

## Capital route and initial work

- `src/app/(shell)/capital/page.tsx` renders a Suspense boundary whose fallback is one text line, then loads the client-only `PaymentsOS` surface.
- `PaymentsOS` starts three independent reads on mount for a signed-in user:
  - `/api/capital/state` (previously a live read unless Activity was the initial tab);
  - `/api/banking/account?light=1`;
  - `/api/payments/overview`.
- `PaymentsOS` also polls `/api/capital/state?fast=1` every 60 seconds, listens to two Capital refresh events, and can refresh the three reads together after a funding event.
- Global `WalletBalanceSync`, mounted in `src/components/providers.tsx`, previously called `/api/capital/state?fast=1` immediately, started a live `/api/capital/state` call 400 ms later, then maintained 45-second fast and 90-second live timers on every authenticated route.
- `AuthProvider.refreshBalance` owns a manual fetch and single-flight map for the same `/api/capital/state` payload.
- `useCapitalWalletQuery` and `useCapitalStateQuery` are duplicate React Query wrappers over the same key and same `/api/capital/state?fast=1` endpoint.
- Authorization and settlement panels add their own React Query reads and refetches.

## Capital cache and refresh layers

- Browser: `resolve.arc.balance.snapshot` stores app and external values; `resolve.wallet.view` stored the selected wallet only in localStorage.
- Client memory: `AuthProvider`, `PaymentsOS`, React Query, and component refs each keep overlapping Capital state.
- Server memory: `withCapitalStateInflight` coalesces Capital state reads.
- Shared cache: `capital:state:fast:{userId}` caches fast state for 20 seconds; `arc:balance:{address}` caches Arc reads for 20 seconds.
- Database: `User.availableUsd` is the previous app-wallet snapshot. It does not represent a connected wallet or a portfolio total.
- Funding events broadly refresh Capital, banking metadata, overview, Communities, Discover, and pool queries in several call sites.

## Wallet and balance sources found

- App wallet: `User.walletAddress`, with a deterministic embedded fallback in `resolveUserWallet` when no persisted address exists.
- Connected wallet: `User.scanWalletAddress`; wagmi address is intentionally not treated as persisted identity.
- Payout records: `PayoutDestination`; these were not part of the Capital wallet resolver.
- Selected Capital wallet: browser-only `resolve.wallet.view`; no server-side selection existed.
- Arc native balance: `eth_getBalance`, normalized from 18 decimals.
- Arc ERC-20 diagnostic interface: `balanceOf` at `0x3600000000000000000000000000000000000000`, normalized from 6 decimals.
- The old reader converted both interfaces to JavaScript numbers and fanned each read out to all RPC providers in parallel. It used `Math.max(native, erc20)` rather than addition, but precision and provider coordination were not deterministic.
- `loadCapitalState` aggregated app and connected wallet values, then exposed app spendable plus connected spendable as one available amount. Client snapshot fallbacks also added both wallets. This was the selected-wallet conflict visible in production.
- A failed live read could be replaced inside the live aggregation with `User.availableUsd` and receive a fresh timestamp, allowing cached data to be represented as live.

## Existing reconciliation behavior

- `finalizeAllPendingArcFundsForUser` runs during live Capital state when pending funding exists.
- `syncIdentityBalance` reconciles the app-wallet Arc value into `User.availableUsd` and writes an adjustment transaction.
- Settlement batches and chain transactions already distinguish submitted and confirmed states in the operating-system schema.
- Fund refresh events merge optimistic statement lines into existing activity, then request authoritative state.

## Profile route and initial work

- `src/app/(shell)/profile/page.tsx` combines `ProfileSettings`, server-rendered eligible work, and contributor identity UI under a narrow client `ProfileShell`.
- `ProfileBootstrapProvider` calls `/api/profile/bootstrap?fast=1` through React Query.
- `ProfileSettings` separately calls `/api/profile/identities`, while `useResolveAccount` independently calls `/api/connectors/status` and `/api/account/wallets`.
- `UserConnectionsProvider` reads `/api/profile/state?fast=1`; connection warmup can also fetch `/api/profile/state` after sign-in.
- `ProfileWorkServer` separately loads profile and eligible work, even though work history does not belong in the new Profile surface.
- `ProfileContributorIdentity` performs provider-specific MusicBrainz search, alias, and link requests inside the main Profile bundle.

## Profile connection-state sources

- Persisted `User` connector fields are the fast source for GitHub, ListenBrainz, Navidrome, Jellyfin, Gmail, and wallet state.
- `SourceConnection` is present in the operating-system schema but is not yet the only source consumed by the current Profile UI.
- `getUserConnectionState` derives a platform list from persisted user fields, Community installs, and an optional MusicBrainz registry lookup.
- `/api/profile/bootstrap` can additionally call live connector status, connector service status, earnings, and Community summaries.
- Browser session snapshots hydrate other tabs, while React Query retains Profile bootstrap and state independently.
- Connection mutations invalidate Profile bootstrap, Profile state, user connections, Communities, and Discover radar together. The merge model has timestamps but no explicit monotonic version comparison, so stale completion ordering can still disagree across consumers.

## Timeouts and polling found

- Capital client timeout: 20 seconds; AuthProvider live timeout: 22 seconds; fast timeout: 8 seconds.
- Previous Arc RPC timeout: 10 seconds per endpoint with all endpoints attempted in parallel.
- Profile bootstrap enrichment timeouts range from 1.5 to 2.5 seconds.
- Capital had a 60-second page poll plus the global 45/90-second balance timers.
- Connected wallet synchronization maintains a separate timer.
- Pending authorization and settlement panels maintain transaction-specific polling.

## Client boundaries and bundle pressure

- Capital route shell is a Server Component, but essentially the entire useful surface is loaded through `PaymentsOS` and the 1,073-line `ResolveBanking` client component.
- Profile shell, settings, bootstrap, contributor identity, connector dialogs, and wallet controls are client components.
- Provider-specific connector forms and MusicBrainz search/link logic ship in the initial Profile bundle.
- No route-specific `loading.tsx` exists for the final Capital or Profile command layouts.

## Controls and state gaps found

- Capital offered Overview and Activity only; wallet selection was browser-only and not an audited mutation.
- Repeated authorizations were not grouped into Decision Inbox packages.
- No persisted deterministic preflight or real guardrail editor was exposed in Capital.
- Several Profile actions directly call routes or only navigate; they do not yet share the required typed Profile action registry.
- Profile mixes identity settings with eligible-work and earnings-adjacent material.
- Profile wallet presentation did not consistently separate app wallet, connected transaction source, and payout destination.

## Correctness changes started from this audit

- Arc native and ERC-20 values now normalize to integer micro-USDC and reconcile without addition.
- Arc providers are attempted sequentially with timeout, single-flight coalescing, and bounded backoff.
- Failed live reads no longer manufacture a live balance from the database snapshot.
- App, connected, and payout wallets have a shared canonical registry shape.
- Selected Capital wallet is persisted and audited; selected available value is no longer the sum of separate wallets.
- Portfolio total is separately identified.
- Global authenticated mounting no longer starts a live Arc RPC read.

Remaining phases are tracked in the master implementation prompt and must not be reported complete until their tests pass.
