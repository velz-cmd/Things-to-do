# RESOLVE Discover — Ship Ledger

Truth-preservation ledger across sessions. Update this file whenever a
phase's status, a blocker's state, or a cross-tab regression changes.
Never delete an unresolved item — mark it resolved with evidence, or
leave it open.

Last updated: 2026-08-23 · HEAD `b88863a2efb1f9777188de9ff3d8ae9ad6e2d99c`

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 — Economic data foundation | PASS | Canonical market layer, source health, deterministic ordering |
| 2 — Software economic graph | PASS | Releases, dependency edges, FUNDING.yml, role truth, durable merge |
| 3 — Research economic graph | **BLOCKED** | Code-complete; `DiscoverResearchSnapshot` migration not yet applied to Supabase (external schema gate) |
| 4–37 | Not started / in progress | See individual phase reports as they land |

## Global blockers (carry forward every session — do not drop)

- **Authenticated Playwright**: PENDING. No `E2E_*`/Supabase test secrets configured in this repo's CI. Never report PASS from a skipped run.
- **Phase 2 live external-enrichment proof**: PENDING. Libraries.io/npm/Docker Preview-env keys appear unconfigured; code path is real and tested, but live-data proof against real numbers has not been captured.
- **Phase 3 research schema migration**: BLOCKED. `prisma/migrations/20260823112411_discover_research_snapshot/migration.sql` is checked in and additive-only. This session's environment cannot reach Supabase over the Postgres wire protocol (HTTPS egress works; raw Postgres ports do not complete a handshake). Apply via the Supabase SQL Editor/dashboard, then resume Phase 3 (ingest → verify → clean-user → screenshots → PASS gate).
- **Agent payment availability**: current real state — Agent Marketplace service purchase/payment flow is not yet live-enabled; do not claim "paid Agent Marketplace complete."
- **Public Pool market**: current real state — see Cross-Tab Correction below; being actively corrected this session.
- **Public Request market**: current real state — needs verification this session (public-vs-personal query architecture).
- **Media shared market**: not yet built (Phase 4, not started).

## Cross-tab regression checklist (run after every phase)

- [ ] Verified Work loads, shows shared multi-domain inventory, zero console errors
- [ ] Open Requests loads, public funded Requests visible independent of viewer
- [ ] Pools loads, market-listed Pools visible independent of viewer, no bureaucracy-first UX
- [ ] Agent Marketplace loads, real service list, no dead buttons
- [ ] Activity loads, shows real market events, not raw account history

## Session log

### 2026-08-23 — Cross-tab public-market correction session
- Verified repo truth: branch `fix/discover-hydration-and-phases`, HEAD `b88863a2`, clean working tree, no divergence from `origin/main` beyond the known merged-PR pattern.
- Created this ledger.
- Next: audit and correct Pools public-vs-personal architecture (explicitly flagged as the most visibly broken surface), then Requests/Verified Work/Agents/Activity truth, then Phase 4.
