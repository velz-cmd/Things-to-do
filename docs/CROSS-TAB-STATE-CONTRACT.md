# RESOLVE cross-tab state contract

## Canonical ownership

| State | Canonical source | Consumers | Rule |
| --- | --- | --- | --- |
| Session and personal identity | Supabase session plus `User` | all tabs | Never infer an authenticated user from client storage alone |
| GitHub personal identity | `User.githubId`, `User.githubUsername`, `SourceConnection(provider=github)` | Profile, Discover, Earn, Communities | A connected identity is reused. Tabs must not ask for another OAuth connection |
| GitHub App access | `SourceConnection(provider=github_app)` and persisted repository snapshots | Profile, Discover, Communities | A provider timeout marks state stale. It does not erase the last persisted repository state |
| Community role | `ResolveCommunityInstall` | Discover, Communities, Mission | My Communities is scoped by the signed-in user ID |
| Program and Pool identity | `ResolveProgram.id` under `ResolveCommunityInstall` | Discover, Communities, Mission, Capital | One program ID remains stable across every projection |
| Evidence | `Evidence` or immutable `DiscoverRepositorySnapshot` activity record | Discover, Mission, Earn | A work card needs a supported accepted activity record and source URL |
| Wallet selection | canonical `Wallet`, with legacy `User` wallet fallback in readiness | Profile, account menu, Capital, Discover | One selected wallet kind and address is shared through `WorkspaceReadinessSnapshot` |
| Payout readiness | verified `PayoutDestination` | Profile, Discover, Earn, Capital | A legacy wallet address alone is not a verified payout destination |
| Authorization | `PaymentAuthorization` | Mission, Communities, Capital, Earn | Authorized is an obligation state, never a payment claim |
| Settlement | `FundingIntent`, `SettlementBatch`, `ChainTransaction` | Capital, Communities, Earn | Submitted is not confirmed |
| Outcome | `Receipt` joined to a complete confirmed `ChainTransaction` | Discover, Earn, Capital | No receipt projection without the authoritative transaction pair |

## Handoff contract

Every cross-tab link carries the canonical entity ID and an encoded `returnTo` value.

- Discover to Mission includes repository or work identity and the current Discover URL.
- Discover to Communities includes the canonical community slug and opens the program console.
- Discover to Capital is enabled only for a financially ready package and includes the program or recipient ID.
- Discover to Profile carries payout or connection intent and the current Discover URL.
- Capital and Profile return without changing the Discover view, search, selected record, or role context.

## Failure contract

- Persisted state renders before live provider refresh.
- GitHub, Circle, Arc, cache, or AI failure is section-scoped.
- Empty degraded refreshes never replace last-known valid records.
- Retry names the failed resource.
- A financial action remains disabled or becomes a setup action when any prerequisite is missing.

## Discover projection contract

- For You is a deterministic action inbox built from readiness, community, program, evidence, payout, authorization, and settlement state.
- People comes from real GitHub-linked account identities with active operator state. Known demo seeds are excluded.
- Verified Work comes from accepted records in canonical evidence or immutable GitHub snapshots.
- Pools comes from genuine GitHub-backed operator programs, including zero-confirmed-balance programs.
- Outcomes comes only from confirmed receipt and transaction pairs.
- My Communities comes from the signed-in user's installs, source connections, repository snapshots, and programs.

