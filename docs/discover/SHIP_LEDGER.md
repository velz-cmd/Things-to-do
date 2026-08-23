# RESOLVE Discover — Ship Ledger

Truth-preservation ledger across sessions. Update this file whenever a
phase's status, a blocker's state, or a cross-tab regression changes.
Never delete an unresolved item — mark it resolved with evidence, or
leave it open.

Last updated: 2026-08-23 · HEAD `b54cfb6d`

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 — Economic data foundation | PASS | Canonical market layer, source health, deterministic ordering |
| 2 — Software economic graph | PASS | Releases, dependency edges, FUNDING.yml, role truth, durable merge |
| 3 — Research economic graph | **BLOCKED** | Code-complete; `DiscoverResearchSnapshot` migration not yet applied to Supabase (external schema gate) |
| 4 — Media/Creator economic graph | **IN PROGRESS / PARTIALLY BLOCKED** — corrected 2026-08-24, was previously overstated as "content-complete" | See "Phase 4 truth correction" in the session log below for the full, non-persistence gap list this ledger previously omitted. |
| 5 — Funding and demand graph | IN PROGRESS | Audited existing economic-matching architecture (`economic-matching.ts`, `attach-economic-match.ts`, `funding-coverage.ts`, `economic-actions.ts`, `funding-preflight.ts`) — see session log for the full map. Fixed a real, concrete gap: media (`listenbrainz_listen`) items were entirely excluded from `attachEconomicMatch()`, so a real Creator Pool could never match a verified play even though the outcome-class logic already handled "creator" correctly. `valuation-eligibility.ts`'s block-based estimates confirmed out of scope (belongs to the separate Capital/Earn/Communities product area, not Discover). |
| 6–37 | Not started / in progress | See individual phase reports as they land |

## Global blockers (carry forward every session — do not drop)

- **Authenticated Playwright**: PENDING. No `E2E_*`/Supabase test secrets configured in this repo's CI. Never report PASS from a skipped run.
- **Phase 2 live external-enrichment proof**: PENDING. Libraries.io/npm/Docker Preview-env keys appear unconfigured; code path is real and tested, but live-data proof against real numbers has not been captured.
- **Phase 3 research schema migration**: BLOCKED. `prisma/migrations/20260823112411_discover_research_snapshot/migration.sql` is checked in and additive-only. This session's environment cannot reach Supabase over the Postgres wire protocol (HTTPS egress works; raw Postgres ports do not complete a handshake). Apply via the Supabase SQL Editor/dashboard, then resume Phase 3 (ingest → verify → clean-user → screenshots → PASS gate).
- **Agent payment availability**: CORRECTED 2026-08-23 — verified live on Preview. `isLiveArcEnabled()` (`src/lib/settlement/arc-config.ts:55`) checks the ERC-8183 feature flag + real Circle credentials + zero live blockers; all 6 real Agent Marketplace services render without the "Payment paused" badge (`discover-marketplace.tsx:1180-1184`), confirmed via authenticated screenshot with no transaction triggered. Arc Testnet USDC service payments are actually live-enabled on this deployment right now.
- **Public Pool market**: verified via live Preview screenshot — deterministic auto-listing (`computePoolListingEligibility`) already puts public market-listed Pools first, operator backlog second. No fix was needed.
- **Public Request market**: verified via live Preview screenshot — public funded Requests render independent of viewer.
- **Verified Work composition**: verified via live Preview screenshot (authenticated) — 12 real outcomes, currently all software/GitHub (navidrome releases) rows. This is expected, not a bug: research rows can't populate until the Phase 3 Supabase migration is applied, and media rows don't exist until Phase 4 ships. Re-check composition after each of those lands.
- **Activity tab public/private gating**: FIXED and shipped (commit `13663aeb`) — confirmed outcomes now render unconditionally, personal ledger sign-in-gated separately. Static regression guard in `tests/unit/discover-activity-shared-market.test.ts`.
- **Media shared market**: IN PROGRESS / PARTIALLY BLOCKED — see "Phase 4 truth correction" in the session log for the full code-slices-completed vs. open-non-schema-gaps breakdown. Not accurately described as blocked only on Postgres; real product-semantic gaps remain open independent of the schema gate (aggregation, identity-claim, period/obligation model, multi-source/multi-operator extensibility, clean-user proof, screenshot QA, accessibility).

## Cross-tab regression checklist (run after every phase)

- [x] Verified Work loads, shows shared multi-domain inventory (software confirmed live; media code-complete but not yet populated in this account's ListenBrainz feed; research pending the Supabase gate), zero console errors
- [x] Open Requests loads, public funded Requests visible independent of viewer
- [x] Pools loads, market-listed Pools visible independent of viewer, no bureaucracy-first UX
- [x] Agent Marketplace loads, real service list, live payments confirmed enabled, no dead buttons
- [x] Activity loads, shows real market events (confirmed outcomes), not raw account history — fixed this session

Re-run after commit `b54cfb6d` (Phase 5 media-matching fix): all five tabs still 200/0 console errors.

## Session log

### 2026-08-23 — Cross-tab public-market correction session
- Verified repo truth: branch `fix/discover-hydration-and-phases`, HEAD `b88863a2`, clean working tree, no divergence from `origin/main` beyond the known merged-PR pattern.
- Created this ledger.
- Audited Pools/Requests: already correct, no code change needed.
- Found and fixed a real bug: Activity tab's `OutcomesView` early-returned on `!data.signedIn`, hiding genuinely public confirmed settlements (`loadConfirmedOutcomes()`, viewer-independent) from anonymous/clean visitors. Restructured to render the public section unconditionally, personal ledger sign-in-gated separately. Added static regression guard. Also root-caused and fixed a real CI timing flake (`github-public-analyze-persistence.test.ts` first-dynamic-import cost exceeding default 5s timeout on `pull_request` runs). Both shipped: commit → push → CI green → Vercel Preview exact-SHA verified → 5-tab smoke PASS. Final HEAD `33466a74`.
- Verified Agent Marketplace payment truth: `isLiveArcEnabled()` is genuinely true on this Preview (real Circle credentials + ERC-8183 flag + no live blockers) — all 6 services show live CTAs, no "Payment paused" badge. Corrected the ledger's prior stale claim that payments were not live-enabled. No transaction was triggered during verification.
- Verified Verified Work composition: 12 real software/GitHub outcomes, no research/media rows yet — expected given Phase 3 is schema-blocked and Phase 4 hasn't started.
- Started Phase 4 (Media/Creator Economic Graph). Audited existing code first per this session's standing discipline: `loadMediaSignals()` (ListenBrainz playback signals) and its wiring in `query.ts` already existed from an earlier session, already correct on identity (strong MusicBrainz recording ID preferred, `canonicalMediaId()`), semantics (never infers royalty/ownership/popularity from a play), UI labeling (no GitHub-styled leak — "Media"/"ListenBrainz" labels), and economic matching (real Pool `creator`-class eligibility, no fabricated per-play rate). `musicbrainz-oauth.ts`/`jellyfin-*.ts`/`navidrome*.ts` turned out to be the user's own Navidrome→ListenBrainz scrobble-pipeline account-linking utilities, not additional independent Discover market data sources — no gap there. The one real, previously-undiagnosed gap: `loadMediaSignals()` swallowed every ListenBrainz failure silently with zero surfaced health, unlike GitHub's connector diagnostics. Added `loadMediaSourceDiagnostic()` (reuses the existing real `pingListenBrainz()` network check, reports connected/refresh_failed honestly, never fabricates `lastSuccessfulAt` on failure) and wired it into the same `sourceDiagnostics` list. Shipped: typecheck clean, 671/671 tests passing (7 new), CI green, Vercel Preview exact-SHA verified (`487dacb`), 5-tab smoke PASS. Final HEAD `487dacb5`.
- Closed a second real Phase 4 UI gap: the generic `WorkRow` only special-cased `research_work` and `open_collective_contribution` — `listenbrainz_listen` items fell through to the GitHub-shaped default (GitBranch icon, GitHub payout/coverage copy), the exact class of styling leak this session has been correcting elsewhere. Added a dedicated `MediaWorkRow` (no GitBranch icon, no fabricated funding CTA — `attachVerifiedWorkActions()` never touches non-`github_evidence` sources, so the real "View on ListenBrainz" primary action is used as-is) plus a static regression guard (`discover-media-work-row.test.ts`). Shipped: typecheck clean, 673/673 tests passing, CI green, Vercel Preview exact-SHA verified (`0a13e88`), 5-tab smoke PASS. Final HEAD `0a13e88c`.
- Closed the last non-Postgres Phase 4 gap: deterministic media identity uncertainty detection (`mediaIdentityUncertainty()`), mirroring research's Part E model - pure function, no network calls. Flags when a listen's identity rests on the weak artist/track/timestamp fallback instead of a real MusicBrainz recording ID (two different recordings can share a title). Unlike research's Crossref/OpenAlex citation-count comparison, a discrepancy-between-sources category does not exist for media yet since ListenBrainz is the only provider - not fabricated. Surfaced through the existing `riskFlags` field (previously always `[]`, so populating it alone would have been invisible) and rendered in `MediaWorkRow`'s Details drawer. Shipped: typecheck clean, 676/676 tests passing (4 new), CI green, Vercel Preview exact-SHA verified (`39e6a2a`), 5-tab smoke PASS. Final HEAD `39e6a2a2`.
- Phase 4 is now content-complete except for durable Postgres persistence with source-aware merge, which is the same external Supabase-reachability gate already blocking Phase 3 - both phases are now explicitly BLOCKED on that one external item, not on missing work in this sandbox.

### 2026-08-24 — Phase 4 truth correction
The previous entry above ("content-complete except for durable Postgres persistence") was an overstatement and is corrected here rather than silently edited away, per this ledger's own "never erase an unresolved item" rule.

**CODE SLICES ACTUALLY COMPLETED (real, shipped, verified):**
- Real ListenBrainz playback observations (`loadMediaSignals()`, pre-existing)
- `canonicalMediaId()` strong-MBID-over-weak-fallback identity preference (pre-existing)
- Playback-only semantics (never infers royalty/ownership/popularity from a play)
- Real per-provider source health (`loadMediaSourceDiagnostic()`, commit `487dacb5`)
- Dedicated `MediaWorkRow`, no GitHub visual leak (commit `0a13e88c`)
- Deterministic weak-identity uncertainty detection (`mediaIdentityUncertainty()`, commit `39e6a2a2`)
- Media now genuinely reaches the economic matcher (commit `b54cfb6d`, Phase 5)

**EXTERNAL SCHEMA DEPENDENCY:**
- Durable Postgres persistence with source-aware merge (mirroring Phase 3's `DiscoverResearchSnapshot` pattern) — blocked on the same Supabase wire-protocol unreachability as Phase 3.

**OPEN NON-SCHEMA PRODUCT GAPS (not started, not fixable by the schema landing):**
- Shared/public media source model — today's single-account ListenBrainz feed has no defined multi-user/multi-operator model.
- Private listening-history non-leakage proof — no test or audit has confirmed a private listening account's data cannot leak into another viewer's projection once multiple accounts exist.
- Canonical recording-level aggregation instead of raw-listen market spam — each listen is currently its own market row; 10 plays of the same track today would be 10 separate rows, not one recording-level outcome with an observation count. Not yet addressed.
- Observation scope semantics (per-listen vs per-recording vs per-artist) — undefined beyond the single-listen row.
- Period semantics for creator obligations (one-time vs monthly vs policy window) — does not exist yet; ties into Phase 5's period model.
- Multi-source aggregation (MusicBrainz/Last.fm cross-validation the way research cross-validates Crossref/OpenAlex) — ListenBrainz is still the only real data source; Last.fm exists only as a ping/cross-validation stub (`pingLastFm()`), not a market data source.
- Multi-operator/community extensibility — the pipeline is hardcoded to one configured `LISTENBRAINZ_USERNAME`, not a per-community or per-operator model.
- Verified creator identity vs payout identity — media items never establish "this artist is a claimed RESOLVE identity," only that a play was observed; no identity-claim flow exists for creators the way GitHub contributor claiming does.
- Explicit creator Pool eligibility beyond broad class matching — today a Pool matches on the coarse `"creator"` class only (see Phase 5 section below); there is no scoping to a *specific* creator/recording the way a Request targets a specific beneficiary.
- Creator obligation foundation — no `Obligation` entity exists for media (or any domain) yet; this is Phase 5 scope, not yet built.
- Coverage-by-period semantics — not applicable yet since no obligation/period model exists.
- Source navigation ("View on ListenBrainz") is still the only real primary action; it is appropriately not a fabricated economic CTA, but this also means no real economic CTA exists yet for media — correct given no Obligation model exists, but worth stating plainly rather than implying completeness.
- Clean-user shared-media proof — not yet captured (requires either multiple real accounts or the schema/persistence work to observe more than one account's data).
- Live persisted media acceptance — blocked on the schema gate above.
- Desktop/mobile screenshot QA with real, populated public media inventory — not yet captured; existing screenshots show zero or a handful of items from a single account, not a populated multi-item market.
- Accessibility audit specific to `MediaWorkRow` — not yet performed (general Details/`<details>` pattern is shared with `ResearchWorkRow`/`WorkRow`, but no dedicated pass has run against the media row specifically).

None of the above are magically resolved by applying the Supabase migration. The schema gate blocks persistence and live multi-item acceptance; it does not touch aggregation semantics, identity-claim flows, period/obligation modeling, or multi-source/multi-operator extensibility, all of which remain genuinely open Phase 4 (and, where they overlap with the general obligation model, Phase 5) work.

### 2026-08-23/24 — Phase 5 (Funding and Demand Graph) started
- Audited the existing economic-matching architecture directly (not via a dead-end fork retrieval attempt - noted for future sessions: forking to "retrieve a prior fork's report" does not work as expected, since a resumed fork only has its own transcript, not a synthesized report; read the source directly instead):
  - `economic-matching.ts` (294 lines): a real, deterministic, already well-built matcher - `FundingIntentCandidate`/`CoverageRecord`/`EconomicMatch` types, `assessOverlap()` already separates purpose from beneficiary (a prior payment for a different purpose never blocks a new one; the exact same obligation is never repaid), `matchImpactToCapital()` already gates delegated capital (Pool/Program/Request) on real sourced impact evidence while leaving direct/recurring support ungated. This module already substantially satisfies Phase 5's Demand/Eligibility/Coverage/Overlap requirements for the mechanisms it covers.
  - `attach-economic-match.ts` (153 lines): bridges the matcher to the live marketplace. **Found and fixed a real gap**: the type guard only allowed `github_evidence` and `research_work` through - `listenbrainz_listen` (media) was silently excluded from ever receiving `economicMatch`, even though `poolOutcomeClasses()`/`outcomeClassFor()` already handle the `"creator"` class correctly. A real Creator Pool could exist and still never match a verified play. This directly corrects an inaccurate claim in this ledger from earlier in the session ("economic matching already correct" for media - it was not; the match was unreachable, not present). Fixed by extending the guard; shipped as commit `b54cfb6d`.
  - `funding-coverage.ts` (621 lines): a separate, richer, GitHub-specific "Command Centre" ledger state model (`FundingAmountState`, `FundingSettlementState`, `ContributorReadiness`) with its own state enum, parallel to `EconomicMatch` - confirms the spec's diagnosis that state is genuinely scattered across two systems today. Not touched this slice; a full unification is a larger, separate piece of Phase 5 work, not yet started.
  - `economic-actions.ts` (428 lines): builds a global cross-domain action feed (`buildEconomicActions()`, consumed by `query.ts` for the "for you"/recommendation queue, not row rendering). Checked whether media items get a degraded action here the way the `WorkRow` bug did - `isWork()` doesn't recognize `creator_collaboration` (media's type), so media items fall through to a generic "Inspect economic state" `detailAction` in this specific feed. **Investigated and decided NOT a bug**: `research_work`/`"research_outcome"` go through the identical fallback and this was never flagged as broken during Phase 3's acceptance - it is consistent, deliberate behavior for every non-classic-"work" domain in this specific global feed, not a media-specific regression. No fix made; documented here so a future session doesn't waste time re-diagnosing it.
  - `valuation-eligibility.ts`/`funding-preflight.ts`: `valuation-eligibility.ts`'s block-based per-listen/per-star estimates ("$10 per qualifying block") looked, at first glance, exactly like the "never manufacture money from stars/listens" violation Phase 5 explicitly forbids - but its import graph (`opportunity-score.ts`, `trending-gaps.ts`, `capital/funder-discovery.ts`, `capital/community-yield.ts`) traces to the separate Capital/Earn/Communities product surfaces, never to the Discover marketplace pipeline (`query.ts`/`discover-marketplace.tsx`). Confirmed out of scope for Discover Phase 5 - not touched. `funding-preflight.ts` (real Arc/Circle preflight checks: balance, spending limit, idempotency key, authorization) is real and already correct; no gap found.
- Shipped: 4 new negative/positive matching tests for media (mirrors the existing research pattern - no funding intent → no match; real eligible Creator Pool → reachable match; wrong-class Pool → no match; playback alone never grants direct-support eligibility), 680/680 tests passing, typecheck clean, production build green, CI green, Vercel Preview exact-SHA verified (`b54cfb6`), 5-tab smoke PASS. Final HEAD `b54cfb6d`.
- Next: continue Phase 5 - the canonical single-state-enum unification (spec section 6) that would fold `funding-coverage.ts`'s separate Command Centre model and `economic-matching.ts`'s `EconomicMatch` into one resolver is the largest remaining real gap, plus partial-coverage amount tracking (spec section 10, currently binary has-coverage/no-coverage, not amount-delta based) and policy versioning (spec section 13, currently absent entirely). Continue per the standing "do not stop" directive; keep Phase 3 BLOCKED and Phase 4 IN PROGRESS/PARTIALLY BLOCKED (not "content-complete").
