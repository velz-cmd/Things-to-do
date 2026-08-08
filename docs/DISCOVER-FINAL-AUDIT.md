# Discover final audit

## Product decision

Discover is RESOLVE's economic action network. It projects persisted activity, evidence, attribution, economic readiness, and confirmed outcomes into four primary views:

1. For You
2. Explore
3. My Activity
4. Outcomes

People, Verified Work, Pools, Programs, and Communities are Explore categories. Pools remain a first-class mechanism without becoming the whole marketplace.

## Confirmed implementation findings

- The canonical read path starts from persisted RESOLVE and GitHub-backed models. A provider refresh is enrichment and does not gate the initial page.
- People require a persisted GitHub identity. Unclaimed people require attributed persisted evidence.
- Verified Work requires an accepted GitHub evidence or repository snapshot record. A connected GitHub account alone is not evidence of accepted work.
- Pool balances count only confirmed funding. Configured targets and pending deposits have separate labels.
- Outcomes require a canonical confirmed receipt. A submitted transaction does not appear as an outcome.
- The current user cannot send direct support to their own payout destination.
- Financial actions require an explicit funding wallet. The managed wallet and connected wallet remain distinct.
- Program review cannot activate a program. Publication, policy, treasury, and lifecycle changes are separate persisted operations.
- Provider failures preserve valid last-known records and expose a source-level retry state.

## UI and interaction audit

- The compact heading and global search match the final Discover directive.
- The page has four top-level views and four intent controls: Earn, Fund, Operate, Explore.
- Explore All groups the highest-ranked current Person, Verified Work, Pool, Program, Community, and Outcome record.
- Each entity has a distinct renderer with fields appropriate to its lifecycle.
- Primary actions open the Discover Action Workbench. Optional external source and full-workspace links remain secondary.
- The workbench is a right-side drawer on desktop and occupies the full viewport width on mobile.
- Workbench state is encoded in the Discover URL through stable action and subject parameters.

## Safety findings fixed in this branch

- Direct support now uses an idempotency key before any transfer begins.
- Managed wallet transfers use a deterministic provider key for safe retries.
- External wallet support verifies the exact Arc transfer before recording confirmation.
- Confirmed direct support creates canonical settlement, transaction, receipt, action-run, and operational event records.
- A failed receipt write after an external broadcast can retry recording without broadcasting again.
- Pool funding requires the exact persisted program identifier and no longer creates a fallback program.
- Program setup metadata accepts only the declared publication, policy, and treasury fields.

## Honest baseline

The earlier production audit recorded three GitHub-linked people, eleven setup-incomplete operator-created Pools, seventeen installations across seven communities, and no supported accepted-work or confirmed receipt records at that snapshot. These are historical observations, not fixtures and not a claim about the database after this branch is deployed. Final production counts must be recorded in `DISCOVER-PRODUCTION-VERIFICATION.md` after the PR deployment exists.

## Out of scope

- Destructive cleanup of legacy production data
- Fabricating activity to populate empty sections
- Manual production financial transfers for testing
- Changes to the canonical Vercel Git connection
- Removal of the inaccessible `ibrahim26/things-to-do` project
- Redesigning other RESOLVE tabs
