# Discover final product decision

## Product lock

Discover is the RESOLVE Funding Coverage Monitor. It helps an open-source community operator answer one repeated question: which accepted work is covered by active funding policy, which records are blocked, which Pool requires attention, and which distributions are confirmed.

The selected operator is a foundation, grants lead, maintainer collective, or community program operator. Contributors use the same evidence chain to understand recognition and payout blockers. Funders inspect verified work and add capital to shared Pools. They never choose recipients or payout weights. An observer or judge can inspect source activity, policy state, and confirmed receipts without seeing private identity data.

## Ten-second experience

The first viewport preserves the Discover name and the existing RESOLVE shell while replacing the former marketing-scale hero with:

1. A compact Discover introduction.
2. Repository, community, source, evaluation, and freshness context.
3. A factual Funding Cycle Pulse.
4. One deterministic next action.
5. The Funding Coverage Matrix and beginning of the Work Ledger.

The page does not lead with Arc, Circle, USDC, AI, agents, or hackathon language. Those systems appear only where they prove settlement.

## Existing interface preserved

Visual reference: commit `94fb1e2`.

- RESOLVE shell and primary Discover navigation
- Dark navy, blue, and violet visual language
- Compact quick actions
- Discover search
- Unpaid Work and Ready to Fund concepts
- Pools as the primary communal-capital name
- Contributors, Live Signals, and confirmed outcomes
- Existing workspace, opportunity board, and value graph below the command centre
- Mission, Communities, Capital, Profile, evidence, program, and receipt handoffs

The large route illustration, large headline, Outcome Campaign interruption, and Arc status strip were removed from the first viewport because they obscured the operator workflow and duplicated information now presented by the command centre.

## Backend infrastructure reused

- Public GitHub repository ingestion and immutable `DiscoverRepositorySnapshot`
- Normalized `Evidence` records and content-hash uniqueness
- `ResolveCommunityInstall`, `ResolveProgram`, `ProgramVersion`, and `PolicyVersion`
- `Identity`, `PayoutDestination`, and `Obligation`
- Program Pool state from confirmed stakes and authorization records
- `FundingIntent`, `SettlementBatch`, `ChainTransaction`, and `Receipt`
- Persisted Mission creation with repository fingerprint, evidence IDs, and return URL
- Existing Capital, Communities, Earn, Profile, program, evidence, and receipt routes

No wallet architecture, settlement authority, or recipient-allocation behavior changed.

## Deterministic read model

`src/lib/discover/funding-coverage.ts` adds server-executed pure selectors:

- `deriveCoverageState`
- `deriveContributorReadiness`
- `deriveAmountState`
- `derivePoolReadiness`
- `deriveSettlementState`
- `deriveFundingCycleStage`
- `deriveNextAction`
- `buildDeterministicSummary`
- `buildCoverageMatrix`
- `buildFundingCoverageCommandCentre`

Unavailable record-level joins remain `null` and display as unavailable. The matrix does not turn missing downstream joins into zero. Submitted, partially confirmed, confirmed, failed, and reconciled settlement states remain separate.

## Work Ledger contract

The Work Ledger is bounded to the persisted repository evaluation. Search, category filters, lifecycle filters, pagination, keyboard-accessible buttons, record URLs, and a detail drawer operate without duplicating canonical financial truth in the browser.

The detail drawer exposes real source activity, evidence reference, snapshot fingerprint, deterministic policy explanation, explicit unavailable identity state, money state, blocker, timeline, and next valid action. It does not invent obligation or identity links.

## Action contracts

| Action ID | Label | Owner | Effect |
| --- | --- | --- | --- |
| `discover.capture_repository_snapshot` | Refresh evaluation | Discover | Persists a repository snapshot and normalized evidence through the existing authenticated API. |
| `discover.select_repository` | Repository | Discover | Preserves repository context in the URL. |
| `discover.search_ledger` | Search Work Ledger | Discover | Filters the bounded client projection. |
| `discover.filter_ledger` | Filter Work Ledger | Discover | Stores filter and category context in the URL. |
| `discover.compare_periods` | Compare periods | Discover | Shows persisted snapshot deltas or the honest baseline state. |
| `discover.open_record` | Inspect | Discover | Opens a URL-addressable detail drawer. |
| `discover.open_evidence` | Inspect evidence | Discover | Opens the persisted GitHub evidence source. |
| `discover.start_mission` | Design funding rule | Mission | Creates an idempotent persisted Mission with evidence and return context. |
| `discover.resolve_identity` | Open contributor | Profile | Routes identity work to the owning surface. |
| `discover.open_program` | Open Pool / View Checkpoint | Communities | Opens the persisted program passport. |
| `capital.open_funding` | Add Funds / View in Capital | Capital | Hands off the selected community and Pool context. |
| `receipt.open` | View receipt | Capital | Opens a confirmed persisted receipt. |
| `receipt.open_arcscan` | View transaction | Capital | Opens the exact persisted Arc transaction hash. |

## Product boundaries

- Discover detects, explains, filters, and coordinates.
- Mission investigates evidence and policy changes.
- Communities owns installations, policies, obligations, and checkpoints.
- Capital owns funding, authorization, settlement, reconciliation, and receipts.
- Profile owns personal identity, GitHub OAuth identity, wallets, and payout destinations.

Discover contains no Settle button, recipient picker, weight control, generated allocation preview, policy editor, or wallet mutation.

## Rejected approaches

- Marketing hero or repository analytics landing page
- Six-column Kanban board
- Marketplace of disconnected cards
- Universal contributor score
- AI-generated financial decision
- Fake activity, Pools, balances, obligations, or receipts
- Submitted transactions counted as paid
- Decorative Arc or agent stream
- Another GitHub connection prompt

## Known backend gap

The current repository does not contain a GitHub App installation model, installation-repository inventory, or signed GitHub webhook verification pipeline. The existing `/api/webhooks/github` route is an older bounty-proof handler. This UI therefore labels its current source truth as persisted GitHub evidence or a persisted public repository snapshot. It does not claim that a GitHub App installation is active.

The GitHub App installation status, signed-delivery lifecycle, permission-revoked state, and event-level installation source remain hidden until their canonical backend exists. Personal GitHub OAuth is not presented as organization installation proof.

## Postponed

- Canonical record-level joins from every evidence row to identity, obligation, Pool, and settlement
- GitHub App installation and repository inventory
- Signed webhook verification and delivery replay UI
- Persisted evaluation-run progress and duplicate-evaluation lock
- Full period comparison beyond immutable snapshot deltas
- Private role-specific identity and payout detail

These capabilities must reuse canonical models and ownership rules rather than be simulated in Discover.
