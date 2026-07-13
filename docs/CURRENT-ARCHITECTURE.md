# Current Architecture

This document records the audited repository state before the replacement master implementation. It distinguishes working infrastructure from presentation-only or fragmented behavior.

## Runtime and repository

- Next.js 15 App Router, React 19, TypeScript, Prisma 6, PostgreSQL.
- Supabase SSR authentication gates authenticated mutations; the app also exposes explicit guest/demo paths.
- React Query is mounted once in `src/components/providers.tsx`. Shared keys and hooks live under `src/lib/query/`.
- The repository contains 238 API route files. Product-facing route groups include Discover, Mission, Communities, Capital, Profile, connectors, authorization, settlement, wallet, receipts, webhooks, and x402.
- Vercel is the production runtime. A local Windows build is not authoritative when the platform-specific SWC binary is invalid; Linux Vercel builds remain the deployment check.

## Product route ownership before consolidation

| Tab | Current strengths | Current overlap/debt |
|---|---|---|
| Discover | Radar/search, pool and opportunity surfaces, community installation entry points, public activity | Some community operations and funding language leak into discovery cards |
| Mission | Persistent signed-in sessions and turns, guest local persistence, Blueprint receipts, analysis/report UI | Simulation and handoff state are spread across response payloads, receipts, URL parameters, and component state |
| Communities | Persistent installs and programs, source/sensor panels, obligations derived from the authorization ledger, an operations console | Recommended actions are calculated in multiple components; identity and settlement readiness rely on derived aggregates without one canonical operating state |
| Capital | Wallet state, program funding, payout/settlement routes, receipt and transaction surfaces | Several money flows use legacy `Float` USD fields and distinct status vocabularies |
| Profile | Signed-in account state, connector truth, GitHub/music/media identities, payout and wallet context | Older connector fields live directly on `User`; source connection state is not represented by a normalized source-connection aggregate |

## Authentication and identity

- Supabase session helpers are used by server routes. `User` is the application profile record keyed by the authenticated user ID.
- Profile connection truth is served through profile bootstrap/state routes and cached through one React Query state.
- GitHub, ListenBrainz, Navidrome, Jellyfin, Gmail, wallet, and other connector data use a mixture of normalized API helpers and legacy fields on `User`.
- Contributor/payout identity is also represented in `ContributorRegistry` and authorization payee keys. A single canonical `Identity` + `PayoutDestination` lineage does not yet exist.

## Mission

- `ResolveMission` and `ResolveMissionTurn` persist signed-in Mission sessions.
- `MissionBlueprintReceipt` persists Blueprint packages, simulation JSON, settlement JSON, program context, funding transaction context, and evidence JSON.
- Guest sessions use local storage intentionally; signed-in flows have server persistence.
- Mission provider calls already have timeout and fallback utilities, but provider provenance and cached-last-known metadata were not exposed consistently.
- Mission-to-Communities and Mission-to-Capital navigation exists, but the complete decision package is not uniformly addressed by one typed handoff record.

## Communities

- `ResolveCommunityInstall` is the existing installation record.
- `ResolveProgram` is the existing operating program record.
- `PaymentAuthorization` is the connector-agnostic obligation/authorization ledger.
- `ResolveTimelineEvent` is the current user/ecosystem/mission event feed.
- Hub aggregates are built by `src/lib/communities/hub-ops-stats.ts` from installs, programs, and authorization rows.
- The console already contains Overview, Programs, Obligations, Identity Desk, Sources, and Activity presentation, plus a settlement-readiness panel.
- The previous implementation calculated operational state separately in portfolio cards and the console. The replacement introduces one state derivation and next-best-action engine.

## Capital and settlement

- Wallet state is exposed through Capital APIs and shared client hooks. `useSpendableUsd` is the existing spendable-balance abstraction.
- Circle developer-controlled wallet support exists under `src/lib/wallet/` and `src/lib/settlement/`.
- Arc reads use viem with primary/fallback RPC resolution.
- Settlement service, live/mock adapters, Arc verification, Circle contract execution, wallet payment routes, program funding, authorization ledger, distribution batches, receipts, and reconciler code already exist.
- Current Circle contract execution used random per-call idempotency keys and polling. Durable request-level idempotency and persisted Circle webhook ingestion are missing.
- Monetary storage is mixed. Many existing models use `Float`; exact integer USDC units are not a universal invariant.

## Arc configuration found during audit

- Chain ID `5042002` was already present.
- Arc Testnet RPC, ArcScan, and the `0x3600…0000` USDC interface were already present.
- RPC fallback infrastructure existed but used a mix of third-party endpoints. It is being consolidated around the official Arc endpoint set plus explicitly configured providers.
- Native gas and ERC-20 token units were not named distinctly. A settlement contract path converted six-decimal UI USD into eighteen-decimal values; this is corrected by separate money helpers.

## Circle and x402

- `@circle-fin/developer-controlled-wallets`, `@circle-fin/x402-batching`, `@x402/core`, and `@x402/evm` are installed.
- Circle API key/entity-secret loading is server-side. The entity secret may be read from an environment variable or legacy `AppConfig` storage.
- x402 routes exist, but paid-context decisions are not centrally registered as product actions.
- A normalized webhook event store, deduplication key, and replay-safe outbox were not present.

## Shared state and caching

- React Query keys currently cover Profile bootstrap/state/work, Discover radar, Capital state, pool stakes, Communities list, and Community surface.
- Mutations invalidate related cross-tab keys in several providers and hooks.
- Upstash-backed server caching and resilient fetch helpers exist.
- There is no single typed action-to-query invalidation map. The new action registry now records affected query domains.

## Existing domain records

The schema already contains tasks, proofs, wallet transactions, settlement records, execution costs, contributor registry, payment authorizations, pending rewards, distribution batches, Mission sessions/turns/receipts, ecosystems, community installs, programs, automation rules, knowledge, timeline events, GitHub scans, and aggregate snapshots.

The replacement domain still needs normalized records for wallet ownership, payout destinations, source connections and sync runs, evidence lineage, identity matches, immutable program/policy versions, obligations, Blueprint/simulation artifacts, funding intents, settlement batches, chain transactions, receipts, operational events, outbox events, webhook events, and general idempotency.

## Principal risks recorded before implementation

1. 707 visible controls had no stable action identifier.
2. Cross-tab next actions could disagree because state was derived in multiple UI components.
3. `Float` USD storage and ambiguous `usdcToWei` naming made six-decimal token units easy to mix with eighteen-decimal Arc native gas units.
4. Async Circle/Arc operations relied heavily on request polling; webhook persistence and replay-safe reconciliation were incomplete.
5. Legacy connector secrets and Circle entity-secret fallback storage require a migration toward encrypted/provider-managed secret storage.
6. Advanced Arc features (Memo, Multicall3From, ERC-8004, ERC-8183) require explicit capability checks and testnet feature flags before becoming visible actions.

