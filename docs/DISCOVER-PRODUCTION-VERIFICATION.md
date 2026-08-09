# Discover production verification

This document is a release checklist. Values remain pending until the single PR deployment exists. Do not create irreversible financial activity only to populate a check.

## Release identity

| Field | Result |
| --- | --- |
| Branch | `codex/discover-final-production` |
| Base SHA | `6c8c6bd852fafe1b6ec5e9723e9e76fe26e3cb14` |
| PR | Pending |
| Merge SHA | Not applicable, this directive forbids automatic merge |
| Canonical Vercel project | `resolve-os-new/resolve` |
| Production domain | `https://resolve-self.vercel.app` |
| Obsolete project | External account cleanup only, ignored-build guard must remain |

## Local release gates

- [x] Prisma Client generation and schema validation
- [x] TypeScript, `npx tsc --noEmit`
- [x] ESLint, no errors and ten pre-existing hook warnings
- [x] Unit tests, 77 files and 289 tests
- [x] Operating-system lifecycle tests, 10 of 10
- [x] Capital and Profile wallet correctness tests, 7 of 7
- [x] Action registry audit, zero unknown IDs and zero dead patterns
- [x] Playwright discovery, 85 tests listed across 10 files
- [x] Production build, Next.js 15.5.19 optimized build completed
- [x] Desktop Discover built-app browser flow
- [x] Mobile Discover at 375 by 812 without page-level overflow
- [x] Rapid top-tab navigation and latest-destination behavior
- [x] Stalled navigation recovery
- [x] Search and URL persistence
- [x] All four Discover views
- [x] Provider failure preserves persisted records, covered by deterministic tests and fallback browser flow
- [x] Canonical entity deduplication rules
- [x] Target, pending, and confirmed amount states remain distinct

The built-app browser run completed 10 of 10 focused Discover and navigation tests. It used an intentionally unreachable local database to exercise truthful fallback behavior. It did not claim to verify the canonical production database.

## PR deployment checks

- [ ] Preview deployment uses the branch SHA
- [ ] Workbench open, close, refresh, and browser back navigation against the deployed build
- [ ] Signed-in canonical database result counts
- [ ] Existing confirmed outcome opens through `/outcomes/[publicReference]`
- [ ] No irreversible financial transaction is created for verification

## Production data checks

| Section | Count | Exact backend reason if empty |
| --- | ---: | --- |
| For You | Pending | Pending deployed production verification |
| People | Pending | Pending deployed production verification |
| Verified Work | Pending | Pending deployed production verification |
| Pools | Pending | Pending deployed production verification |
| Programs | Pending | Pending deployed production verification |
| Communities | Pending | Pending deployed production verification |
| My Activity | Pending | Pending deployed production verification |
| Outcomes | Pending | Pending deployed production verification |

## Financial safety checks

- Confirm the two current-user wallet addresses remain distinct in storage and UI.
- Confirm no wallet is selected automatically.
- Confirm self-support is rejected.
- Confirm duplicate direct-support submissions reuse the same action run.
- Confirm submitted settlement state is preserved across a provider failure.
- Inspect an existing confirmed receipt if one exists. Do not send funds solely for this checklist.

## Deployment policy

Open one PR and let the canonical Git integration create its normal deployment. Do not use `vercel deploy`, a deploy hook, or a manual production deployment. Do not modify the current canonical Git connection.
