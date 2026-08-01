# Discover final product decision

## Product decision

Discover is RESOLVE's Economic Action Network. It answers four questions from canonical state:

1. What valuable activity happened?
2. Who created or owns that value?
3. What economic condition or blocker exists?
4. What is the next permitted action?

The customer journey is external activity, evidence, attribution, economic state, action, settlement, receipt, and confirmed outcome. Pools remain one funding mechanism. They are not the main information architecture.

## Current and broken journeys

The previous production projection placed active legacy `ResolveProgram` records in both For You and Pools. The same underlying program could appear in recommendations, opportunity cards, Pool cards, and operator summaries. These were duplicate projections, even when their IDs were distinct.

Program cards used an active database status as a customer-facing configured state. The actual financial prerequisites live in program metadata and versioned records. `publicationStatus`, `policyStatus`, and `treasuryAddress` were not reflected in the label. The generic setup action then opened a community Programs tab without encoding the missing step.

The Discover server gave Supabase session resolution one second. A valid but slower session became `null`, while the client shell retained its signed-in state. This caused My Communities to request sign-in under a visibly authenticated account.

People required both GitHub ID and username plus an active install or program. That excluded genuine claimed GitHub profiles and attributed contributors. Verified Work depended on accepted records in the last persisted repository snapshot. The empty state did not show the repository, evaluation period, inspected events, freshness, or exact exclusion reason.

## Canonical data sources

| Surface | Canonical sources |
| --- | --- |
| For You | Workspace readiness, identities, evidence, programs, obligations, authorizations, settlements, receipts |
| Explore | Evidence, claimed GitHub users, communities, programs, Pools, confirmed receipts |
| My Activity | Signed-in workspace readiness, installs, source connections, programs, claims, authorizations |
| Outcomes | Confirmed chain transactions with persisted receipts only |
| Repository diagnostics | Persisted `GithubOssScan` or `DiscoverRepositorySnapshot`, source connection and sync readiness |

Provider results supplement persisted state. A provider timeout cannot replace the last successful snapshot with an empty result.

## Canonical Economic Action read model

`EconomicActionItem` is a derived server-side read model. It does not replace evidence, programs, obligations, settlements, or receipts. Each item retains one stable subject identity and includes provenance, freshness, attribution, lifecycle, amount state, readiness, blocker, and one primary action.

Deterministic code controls visibility, permissions, recipient readiness, policy readiness, amount state, and financial actions. AI may rank or explain these records later, but it cannot create them or bypass a blocker.

## Lifecycle and action rules

A legacy program is visible when its source and ownership are genuine. Its exact lifecycle remains incomplete until the missing canonical relationship is repaired:

- Missing publication approval: Review publication
- Missing active policy: Design policy
- Missing Arc treasury destination: Add treasury destination
- All prerequisites present: Review funding package or add USDC after Capital preflight

Public viewers receive inspect actions. Only the owning workspace receives operator mutation or setup actions.

Complex handoffs include the subject, exact step, and return path. Communities receives `program`, `step`, and `returnTo`. Mission receives repository and evidence context. Capital receives an intent and program or recipient. Profile receives the exact identity, connection, wallet, or payout section.

## Final navigation

- For You: role-aware economic action inbox
- Explore: one network search with entity and economic-state filters
- My Activity: the signed-in user's work, setup, claims, funding, and operator responsibilities
- Outcomes: confirmed settlements and receipts only

People, Work, Communities, Pools, Programs, and Funding gaps are Explore filters. My Communities remains owned by the Communities product and appears in Discover only as an operator activity summary.

## GitHub evidence state

GitHub analysis is optional and does not gate public Discover. A repository diagnostic reports the repository, evaluation period, inspected events, accepted events, last successful synchronization, stale state, and exact reason when no supported activity qualifies. Signed-in users may persist a refreshed snapshot through the existing protected snapshot action. Public users may run a non-mutating analysis.

Supported accepted activity is limited to merged pull requests, submitted reviews, merged documentation changes, and releases with reliable attribution. A missing policy means the work is verified but not yet fundable.

## Architecture implemented

The implementation reuses the existing Supabase session, Prisma records, GitHub snapshot store, action registry, Mission engine, Communities program policy editor, Capital preflight and settlement paths, Earn records, and receipt routes. Discover is a read and orchestration surface over those systems. It does not own a second payment or evidence architecture.
