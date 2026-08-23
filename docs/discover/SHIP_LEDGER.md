# RESOLVE Discover — Ship Ledger

Truth-preservation ledger across sessions. Update this file whenever a
phase's status, a blocker's state, or a cross-tab regression changes.
Never delete an unresolved item — mark it resolved with evidence, or
leave it open.

Last updated: 2026-08-23 · HEAD `487dacb5`

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 — Economic data foundation | PASS | Canonical market layer, source health, deterministic ordering |
| 2 — Software economic graph | PASS | Releases, dependency edges, FUNDING.yml, role truth, durable merge |
| 3 — Research economic graph | **BLOCKED** | Code-complete; `DiscoverResearchSnapshot` migration not yet applied to Supabase (external schema gate) |
| 4 — Media/Creator economic graph | IN PROGRESS | ListenBrainz playback signals + real source health now shipped (this session). Still missing: durable persistence with source-aware merge (mirroring Phase 3's pattern — blocked on the same Supabase reachability gate as Phase 3 if attempted now), dedicated media-vocabulary UI row (currently reuses generic `WorkRow` with correct but non-dedicated "Media"/"ListenBrainz" labels), deterministic uncertainty detection. Economic matching already correct (real Pool eligibility via `creator` class, no fabricated per-play rate). |
| 5–37 | Not started / in progress | See individual phase reports as they land |

## Global blockers (carry forward every session — do not drop)

- **Authenticated Playwright**: PENDING. No `E2E_*`/Supabase test secrets configured in this repo's CI. Never report PASS from a skipped run.
- **Phase 2 live external-enrichment proof**: PENDING. Libraries.io/npm/Docker Preview-env keys appear unconfigured; code path is real and tested, but live-data proof against real numbers has not been captured.
- **Phase 3 research schema migration**: BLOCKED. `prisma/migrations/20260823112411_discover_research_snapshot/migration.sql` is checked in and additive-only. This session's environment cannot reach Supabase over the Postgres wire protocol (HTTPS egress works; raw Postgres ports do not complete a handshake). Apply via the Supabase SQL Editor/dashboard, then resume Phase 3 (ingest → verify → clean-user → screenshots → PASS gate).
- **Agent payment availability**: CORRECTED 2026-08-23 — verified live on Preview. `isLiveArcEnabled()` (`src/lib/settlement/arc-config.ts:55`) checks the ERC-8183 feature flag + real Circle credentials + zero live blockers; all 6 real Agent Marketplace services render without the "Payment paused" badge (`discover-marketplace.tsx:1180-1184`), confirmed via authenticated screenshot with no transaction triggered. Arc Testnet USDC service payments are actually live-enabled on this deployment right now.
- **Public Pool market**: verified via live Preview screenshot — deterministic auto-listing (`computePoolListingEligibility`) already puts public market-listed Pools first, operator backlog second. No fix was needed.
- **Public Request market**: verified via live Preview screenshot — public funded Requests render independent of viewer.
- **Verified Work composition**: verified via live Preview screenshot (authenticated) — 12 real outcomes, currently all software/GitHub (navidrome releases) rows. This is expected, not a bug: research rows can't populate until the Phase 3 Supabase migration is applied, and media rows don't exist until Phase 4 ships. Re-check composition after each of those lands.
- **Activity tab public/private gating**: FIXED and shipped (commit `13663aeb`) — confirmed outcomes now render unconditionally, personal ledger sign-in-gated separately. Static regression guard in `tests/unit/discover-activity-shared-market.test.ts`.
- **Media shared market**: IN PROGRESS (Phase 4). Real ListenBrainz playback signals were already live (pre-existing, cache-resilient, correct "proves playback only" semantics, real Pool-based economic matching). This session added real per-provider source health (`loadMediaSourceDiagnostic()`, commit `487dacb5`) — previously every ListenBrainz failure was silently swallowed with zero visibility, unlike GitHub's connector diagnostics. Remaining Phase 4 gap: durable Postgres persistence with source-aware merge (same pattern as Phase 3's `DiscoverResearchSnapshot` — deliberately NOT started yet, since this sandbox cannot reach Supabase over the Postgres wire protocol and adding a second blocked migration would just duplicate the Phase 3 gate); a dedicated media UI row/Details drawer (currently correct but generic); deterministic media uncertainty detection.

## Cross-tab regression checklist (run after every phase)

- [x] Verified Work loads, shows shared multi-domain inventory (software only today — research/media pending), zero console errors
- [x] Open Requests loads, public funded Requests visible independent of viewer
- [x] Pools loads, market-listed Pools visible independent of viewer, no bureaucracy-first UX
- [x] Agent Marketplace loads, real service list, live payments confirmed enabled, no dead buttons
- [x] Activity loads, shows real market events (confirmed outcomes), not raw account history — fixed this session

## Session log

### 2026-08-23 — Cross-tab public-market correction session
- Verified repo truth: branch `fix/discover-hydration-and-phases`, HEAD `b88863a2`, clean working tree, no divergence from `origin/main` beyond the known merged-PR pattern.
- Created this ledger.
- Audited Pools/Requests: already correct, no code change needed.
- Found and fixed a real bug: Activity tab's `OutcomesView` early-returned on `!data.signedIn`, hiding genuinely public confirmed settlements (`loadConfirmedOutcomes()`, viewer-independent) from anonymous/clean visitors. Restructured to render the public section unconditionally, personal ledger sign-in-gated separately. Added static regression guard. Also root-caused and fixed a real CI timing flake (`github-public-analyze-persistence.test.ts` first-dynamic-import cost exceeding default 5s timeout on `pull_request` runs). Both shipped: commit → push → CI green → Vercel Preview exact-SHA verified → 5-tab smoke PASS. Final HEAD `33466a74`.
- Verified Agent Marketplace payment truth: `isLiveArcEnabled()` is genuinely true on this Preview (real Circle credentials + ERC-8183 flag + no live blockers) — all 6 services show live CTAs, no "Payment paused" badge. Corrected the ledger's prior stale claim that payments were not live-enabled. No transaction was triggered during verification.
- Verified Verified Work composition: 12 real software/GitHub outcomes, no research/media rows yet — expected given Phase 3 is schema-blocked and Phase 4 hasn't started.
- Started Phase 4 (Media/Creator Economic Graph). Audited existing code first per this session's standing discipline: `loadMediaSignals()` (ListenBrainz playback signals) and its wiring in `query.ts` already existed from an earlier session, already correct on identity (strong MusicBrainz recording ID preferred, `canonicalMediaId()`), semantics (never infers royalty/ownership/popularity from a play), UI labeling (no GitHub-styled leak — "Media"/"ListenBrainz" labels), and economic matching (real Pool `creator`-class eligibility, no fabricated per-play rate). `musicbrainz-oauth.ts`/`jellyfin-*.ts`/`navidrome*.ts` turned out to be the user's own Navidrome→ListenBrainz scrobble-pipeline account-linking utilities, not additional independent Discover market data sources — no gap there. The one real, previously-undiagnosed gap: `loadMediaSignals()` swallowed every ListenBrainz failure silently with zero surfaced health, unlike GitHub's connector diagnostics. Added `loadMediaSourceDiagnostic()` (reuses the existing real `pingListenBrainz()` network check, reports connected/refresh_failed honestly, never fabricates `lastSuccessfulAt` on failure) and wired it into the same `sourceDiagnostics` list. Shipped: typecheck clean, 671/671 tests passing (7 new), CI green, Vercel Preview exact-SHA verified (`487dacb`), 5-tab smoke PASS. Final HEAD `487dacb5`.
- Next: close the remaining Phase 4 gaps that don't require Postgres reachability (dedicated media UI row/Details drawer, deterministic media uncertainty detection), continue deferring durable media persistence until the Phase 3 Supabase gate is resolved (avoid duplicating the same external blocker). Keep Phase 3 BLOCKED until the Supabase migration is applied.
