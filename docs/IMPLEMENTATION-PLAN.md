# Replacement Master Implementation Plan

## Phase 1 — Product and financial infrastructure

### 1. Audit and ownership

- [x] Read routes, imported product components, schema, Arc/Circle helpers, caching, authentication, and existing tests.
- [x] Generate a repository-wide action manifest.
- [x] Freeze tab ownership and canonical state ownership.
- [x] Record Arc/Circle integration and unit boundaries.

### 2. Shared primitives

- [x] Add typed action IDs, lifecycle, precondition, recovery, execution, audit, and invalidation metadata.
- [x] Add separate six-decimal USDC token and eighteen-decimal Arc gas helpers.
- [x] Add provider fallback provenance and cached-last-known behavior.
- [x] Add normalized persistence models, additive migration, transactional outbox, webhook deduplication, and general idempotency service.
- [ ] Add an action execution adapter that wraps existing route handlers without duplicating business logic.

### 3. Communities operating loop

- [x] Add canonical community operating states.
- [x] Add one next-best-action engine.
- [x] Make hub cards and console use the same state/action result.
- [ ] Add stable action IDs and visible recovery reasons to all Communities actions.
- [x] Complete Action Queue, Identity Resolution Desk, Policy Sandbox, Sources, Obligations, Settlement Readiness, and Activity projections using stored data only.

### 4. Persistent handoffs

- [x] Persist immutable Blueprint and simulation versions.
- [ ] Create Mission → Communities handoff records with community/program context.
- [ ] Create Communities → Capital funding/settlement package records.
- [ ] Ensure Capital resolves the stored package and preserves the Mission return path.

### 5. Settlement hardening

- [x] Correct the Arc token/gas unit boundary in the ERC-8183 budget path.
- [x] Replace random retry keys in the new financial paths with durable operation idempotency keys.
- [x] Persist Circle Gateway/webhook events and reconcile them through the outbox.
- [ ] Confirm Arc event/amount/recipient before receipt creation.
- [x] Add capability-gated Memo batch settlement; Multicall3From remains disabled until contract-level test coverage is present.

## Phase 2 — Premium product experience

- [x] Apply the Communities network-operations visual system consistently to hub, console, drawers, tables, status chips, and mobile layouts.
- [ ] Add progressive detail loading and background refresh without duplicate requests.
- [x] Add product-level action queue and exact disabled reasons.
- [x] Add public program passport backed by confirmed program, obligation, and receipt data.
- [ ] Add creator/contributor claim and payout-destination recovery experience.
- [x] Keep ERC-8004 and ERC-8183 differentiators behind explicit feature flags and remove fabricated production success.

## Verification gates

- `npm run audit:actions` regenerates the complete manifest.
- `npm run verify:actions` fails on unknown action IDs and detected dead-control patterns.
- `npm run verify:actions:strict` additionally fails while any visible control lacks a stable action ID.
- Unit coverage: money units, state derivation, next-best action, preconditions, fallback provenance, idempotency.
- Integration coverage: install → sync → program → obligation → simulation → funding → settlement → receipt.
- Browser coverage: desktop/mobile, signed-out recovery, cross-tab handoffs, pending/rejected/sync-failed states.
- Vercel production build and post-deploy browser smoke test are the final runtime gates.

## Completion rule

The replacement is complete only when every visible product action is registered and uses its lifecycle, all cross-tab handoffs resolve persistent records, Circle/Arc events are replay-safe, receipts require confirmation, and the strict action audit passes.

## Current verification snapshot

- Application TypeScript check: passing.
- Operating-system unit suite: 6/6 passing, including canonical settlement-package hashing.
- Action audit: no unknown action IDs and no dead-control patterns; legacy controls without stable IDs remain enumerated in `ACTION-MANIFEST.md` and keep the strict gate intentionally red.
- Local production build: passing; all 228 routes generated. Existing optional WalletConnect/MetaMask dependency warnings and existing React hook warnings remain non-blocking.
- Browser smoke: homepage, Discover, Mission quick start, Communities empty state, and Communities catalog verified against the local production server with no desktop horizontal overflow.
