# Capital and Profile implementation report

## 1. Audit findings

- Capital previously entered the legacy PaymentsOS/ResolveBanking composition even though the repository already contained canonical Capital, wallet, authorization, settlement, chain-transaction, and receipt services.
- Profile components, APIs, prefetch behavior, and architecture documentation existed, but Profile was absent from the primary navigation while Earn remained present.
- Capital balance state was duplicated across AuthProvider, wallet synchronizers, React Query hooks, PaymentsOS, and ResolveBanking. The recovered consolidated Capital bootstrap now owns initial page data and manual live synchronization.
- Profile made overlapping bootstrap, state, identity, connector, wallet, and connected-work requests. The new Profile bootstrap prioritizes persisted identity, source, wallet, payout, relationship, and economic summaries; connected work loads only when its view opens.
- Existing normalized lifecycle tables already covered wallets, payout destinations, source connections, identities, claims, obligations, funding intents, settlement batches, chain transactions, receipts, operational events, and action runs. No duplicate domain model was added.
- Git history contained an unmerged six-commit Capital/Profile implementation sequence. Compatible wallet-correctness, bootstrap, action-lifecycle, and initial UI work was recovered onto the current main lineage before the current brief was completed.

The detailed route, state-ownership, history, migration, and risk inventory is in [CAPITAL-PROFILE-IMPLEMENTATION-AUDIT.md](./CAPITAL-PROFILE-IMPLEMENTATION-AUDIT.md).

## 2. Profile implementation

- Restored Profile to the primary application navigation without removing or merging Earn.
- Rebuilt `/profile` as a narrower, calm identity passport with Overview, Identities, Sources, Work & claims, Wallets & payout, Relationships, and Account views.
- Preserved legacy `section=connections`, `section=identity`, `section=payouts`, wallet, security, activity, work, and claim links through canonical `view=` aliases.
- Added real role labels derived from persisted GitHub/media connections, verified identities, ledger entries, installed communities, operated programs, and funded programs.
- Added exact readiness prerequisites without percentages or invented scores.
- Consolidated persisted identities, sources, claims, wallets, payout state, community relationships, economic summaries, settlement/receipt context, security state, and account activity in the Profile bootstrap.
- Kept connected-work evaluation progressive and abortable so it does not block the identity header or initial controls.
- Kept source synchronization provider-scoped and idempotent. Disconnect actions retain confirmation and lifecycle records.
- Added `/api/profile/payout-destination` with explicit confirmation, address validation, normalized wallet inventory synchronization, idempotent ActionRun/OperationalEvent recording, cache invalidation, and truthful verification states:
  - application-managed wallet: verified from wallet inventory;
  - external wallet: pending until ownership proof exists.
- Verified app-wallet payout selection can unblock eligible obligations and their ledger entries without creating transfers.
- Kept balances and detailed financial history in Capital and Earn rather than duplicating them in Profile.

## 3. Capital implementation

- Replaced the route-level legacy PaymentsOS composition with a dedicated financial-operations surface.
- Preserved the canonical Treasury, Pending, Claims, and History structure and legacy view aliases.
- Added a treasury command band that separates selected-wallet on-chain balance, application spendable balance, reserved capital, pending authorization, pending settlement, claimable earnings, confirmed 30-day settlement, and portfolio total.
- Preserved the existing application/external wallet selector and Add funds/Send handlers.
- Added an adaptive single header action based on real persisted state.
- Added an attention queue for missing wallets, stale state, pending authorizations, blocked claims, and unconfirmed settlements.
- Unified persisted FundingIntent, PaymentAuthorization, and SettlementBatch records in the Pending surface with search, type, and status filtering plus durable references and context-preserving links.
- Added financial claims from Obligation records with exact identity/payout recovery links into Profile and a return URL to the same Capital claim.
- Added confirmed settlement, receipt, and ArcScan truth links without labeling pending transactions as settled.
- Extended the consolidated Capital bootstrap with funding intents, claims, chain transaction state, failure details, and receipt references.
- Preserved `missionReport`, `program`, `community`, `fundingIntent`, `settlementBatch`, and safe local `returnTo` parameters in a contextual handoff panel.
- Corrected legacy `/settings` and `capital?tab=programs` links to the canonical Profile and Capital views.

## 4. State and lifecycle guarantees

- No duplicate wallet, balance, payout, obligation, settlement, or receipt schema was introduced.
- Arc native and ERC-20 USDC representations remain reconciled without addition or double counting.
- Portfolio value remains separate from the selected wallet's spendable value.
- External payout selection does not create a false verified state.
- Settlement rows expose persisted batch state, chain state, failure details, transaction hash, and receipt reference independently.
- Financial actions remain behind existing handlers and authenticated APIs; no static UI action directly settles an unpersisted payload.

## 5. Performance work

- Capital initial state uses one server bootstrap and one React Query cache entry. Live Arc synchronization is explicit rather than duplicated during mount.
- Profile initial state uses one server bootstrap and one React Query cache entry.
- Slow connected-work calculation is isolated to its view and cancelled on unmount.
- Provider synchronization is scoped to the selected connector instead of refreshing every source.
- Server queries use bounded `take` limits and targeted selects for initial surfaces.

## 6. Accessibility and responsive work

- Restored semantic navigation links and active states for Profile subroutes.
- Primary views use semantic headings, navigation/tab roles, buttons, links, tables, labels, status regions, and keyboard-visible focus styles.
- The Capital guest entry exposes a real page heading.
- Dense tables use horizontal containment at narrow widths; the primary tab bars scroll horizontally.
- Focused Playwright checks confirm Capital and Profile do not create document-level horizontal overflow at a 390px viewport.

## 7. Validation results

- Prisma client generation: passed.
- Prisma schema validation with isolated placeholder `DATABASE_URL`: passed.
- TypeScript `tsc --noEmit`: passed.
- `next lint`: passed with pre-existing hook warnings outside this implementation.
- Vitest: 58 files, 200 tests passed.
- Operating-system lifecycle tests: 10 passed.
- Capital wallet correctness tests: 7 passed.
- Capital/Profile navigation unit tests: 2 passed.
- Action audit: passed; 0 unknown action IDs and 0 dead patterns.
- Production build: passed; 235 routes generated. Existing optional WalletConnect/MetaMask logging dependency warnings remain non-fatal.
- Playwright discovery: 73 tests across 8 files discovered under Node 20. Playwright 1.61 fails during discovery under the local Windows Node 22 loader with `context.conditions?.includes is not a function`; the same suite discovers and runs under Node 20.
- Focused Playwright checks: 3 passed (Capital guest entry, Profile + Earn navigation, 390px Capital/Profile containment).

## 8. Manual verification still requiring an isolated authenticated environment

- Authenticated desktop and mobile screenshots of every Profile and Capital view.
- Real Supabase-backed identity/source/claim persistence across refresh.
- External wallet ownership proof and removal flows.
- Circle application-wallet provisioning where credentials are configured.
- Arc live-balance synchronization, funding execution, settlement submission, confirmation, partial failure, reconciliation, and receipt issuance.
- Full authenticated Playwright lifecycle with the GitHub CI E2E secrets.

No Vercel deployment, production database migration, production mutation, merge, or main-branch push was performed.
