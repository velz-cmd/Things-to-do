# Discover final production audit

## Scope

This branch completes the Discover vertical slice only. It uses current Communities, Profile, Capital, settlement, receipt, GitHub, and wallet services through a Discover-local action workbench.

## Definition of done

- Exactly four top-level Discover views
- One compact product promise and one global search
- Entity-specific cards for People, Verified Work, Pools, Programs, Communities, and Outcomes
- A single contextual workbench that keeps primary actions in Discover
- URL-preserved action, subject, view, intent, search, repository, and community context
- Runtime-validated program setup and direct-support inputs
- Explicit wallet choice for every Discover funding action
- Idempotent direct support with canonical confirmation and receipt
- Exact lifecycle labels for Pool, program, settlement, and outcome state
- Persisted data survives provider refresh failures
- No fixtures or synthetic marketplace records
- Full local validation and a single reviewable PR

## Review gates

1. TypeScript and Prisma must pass before browser testing.
2. Financial logic tests must prove no self-support and no duplicate transfer path.
3. Production build must pass without changing environment or deployment integration.
4. Desktop and mobile browser verification must cover all four views and each workbench panel that can be exercised without irreversible effects.
5. Production claims must be written only after an actual canonical deployment is inspected.

## Known external cleanup

`ibrahim26/things-to-do` is an inaccessible obsolete Vercel project owned by another account. It is not a release blocker. The ignored-build guard remains the technical protection. Its account owner can remove the stale connection later.

## Release decision

This branch may be pushed and opened as one PR after every local gate passes. It must not be merged automatically under the current directive.
