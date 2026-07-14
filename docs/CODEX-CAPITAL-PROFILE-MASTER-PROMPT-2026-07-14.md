# CODEX MASTER PROMPT

## RESOLVE CAPITAL COMMAND CENTER + PROFILE IDENTITY CONTROL PLANE + ARC BALANCE AND PERFORMANCE REPAIR

Repository: `velz-cmd/Things-to-do`

Development branch: `codex/post-release-hardening`

## IMPORTANT RELEASE RULES

- Work only on `codex/post-release-hardening`.
- Commit and push only to that branch.
- Do not merge into `main`.
- Vercel access is restored, but this implementation task is code-only.
- Do not invoke Vercel, create preview deployments, change Vercel project settings, or edit Vercel environment variables during this task.
- Prepare the branch for one later controlled Vercel deployment only after explicit approval.
- Do not expose environment-variable values.
- Do not replace working Arc, Circle, Supabase, authentication, wallet, funding, settlement, claim, or receipt logic.
- Do not create new Circle wallets, wallet sets, entity secrets, API keys, or replacement treasury infrastructure when the existing resources already exist.
- Preserve the established wallet roles:
  - Personal RESOLVE app wallet: `0x59453c110d0bc4f63cc55ecca8e71017706e68d4`; Circle wallet ID `5ed75262-fe2d-5288-8b5b-176ea5219ccb`. This remains a user wallet stored in Supabase, not a platform environment variable.
  - Settlement treasury: `0xd8c4bb234e42b87109c42a928e908d73c0e6bc3c`; Circle wallet ID `8680137f-c112-51ff-b544-e75ad58c3b9a`.
  - Provider/platform-fee wallet: `0xaed9af58c965b8bc3aedb126522693ffcdb6d944`; Circle wallet ID `69885467-baa7-5175-ae57-d2af3e165133`.
  - Treasury/provider wallet set: `52cc4ccb-0d02-5d7c-9f62-8becc86c2825`.
  - `0xDD81E79E22053a4d7036D6E9DB22Dad591b65511` remains the separate RESOLVE agent/escrow address and must not replace the Circle treasury or provider wallets.
- Reuse existing environment-variable names and infrastructure. Add a new variable only when the repository has no correct existing configuration path, and report the variable name without its value.
- Do not stop after creating an audit or design plan.
- Implement and test the requested work.

## VERCEL AND EXISTING INFRASTRUCTURE STATUS

Vercel service and account access are restored. This changes deployment readiness, not the release rule for this task.

- Treat the current production Vercel configuration as authoritative.
- Do not create replacement secrets merely because a live read fails.
- Do not create replacement Circle wallets or wallet sets.
- Do not change production URLs, domains, callbacks, Git integration, or environment scope.
- Keep the implementation compatible with the existing Production and Preview variables.
- Report every required environment-variable name and whether it is already used by the repository, but never print a value.
- Final output must state whether the branch is ready for a single later controlled deployment.

---

## PRIMARY OBJECTIVE

Rebuild Capital and Profile as two distinct, premium, production-quality operating surfaces.

CAPITAL must become:

The control center for wallet state, authorization packages, treasury guardrails, settlement preflight, Arc execution, reconciliation, claims, transactions, and receipts.

PROFILE must become:

The control plane for user identity, linked platform identities, source connections, wallets, payout destinations, permissions, privacy, security, and account readiness.

Do not make either tab a generic settings dashboard.

Do not duplicate Discover, Mission, Communities, or Earn functionality.

---

## CURRENT FAILURES TO FIX

### CAPITAL

1. Capital uses a narrow centered layout with excessive unused page space.
2. It resembles a basic wallet page rather than a treasury operating system.
3. The Arc balance takes too long to appear.
4. The interface can show:
   - Arc connection failed
   - $0 available
   - cached wallet buttons showing non-zero balances
   at the same time.
5. Cached and live values are not communicated clearly.
6. App-wallet and connected-wallet values are not presented consistently.
7. A failed RPC request appears capable of downgrading a valid cached balance to zero or an error-looking state.
8. Initial page load performs too much network work.
9. The page contains educational and marketing content that does not belong in Capital:
   - How money moves
   - Creators & contributors
   - Any funder
   - Funder/operator explanation
   - Community operators explanation
   - RESOLVE rail explanation
10. Pending obligations are shown as long repetitive lists without proper grouping, evidence, batching, authorization, or next actions.
11. Overview and Activity are insufficient for the real Capital lifecycle.
12. Buttons lack a strong operational hierarchy.
13. Technical network failures dominate the user experience.
14. The page lacks a useful treasury and settlement diagram.
15. The page does not clearly distinguish:
    - available;
    - reserved;
    - committed;
    - pending;
    - claimable;
    - settled.

### PROFILE

1. Profile currently mixes identity, connectors, work, eligibility, wallets, earnings, and setup without a strong hierarchy.
2. Connector states may load or flicker separately.
3. Profile can perform too many enrichment requests during initial rendering.
4. Platform identities are not presented as one coherent identity network.
5. Users cannot immediately understand what is preventing them from:
   - being attributed;
   - joining programs;
   - receiving obligations;
   - receiving settlement;
   - claiming earnings.
6. Wallet linking and payout setup are not organized as distinct concepts.
7. Connector actions are visually repetitive and unclear.
8. Profile must not become another Capital or Earn page.
9. Security, permissions, sessions, privacy, and OAuth scope management are not organized into one serious account-control surface.
10. Profile needs its own design identity while remaining part of RESOLVE.

---

## STRICT PRODUCT OWNERSHIP

### CAPITAL OWNS

- Wallet balance snapshots
- Wallet-source selection for transactions
- Available, reserved, committed, pending and claimable amounts
- Campaign and program funding requirements
- Authorization packages
- Settlement preflight
- Treasury guardrails
- Arc/Circle transaction submission
- Pending transaction reconciliation
- Batch settlements
- Claims
- Receipts
- Capital activity
- Explorer references
- Failed or reversed financial actions

### PROFILE OWNS

- Account identity
- Email and account state
- Connected platform identities
- Source account connections
- Wallet links
- Default payout destination
- Creator and contributor identity claims
- OAuth permissions
- Security settings
- Active sessions
- Privacy and visibility
- Account export
- Account deletion
- Connection setup and reauthorization

### DISCOVER OWNS

- Opportunity discovery
- Outcome Campaign discovery
- Value Events
- Pools
- Public funding opportunities

### MISSION OWNS

- Investigation
- Policy design
- Simulation
- Blueprints
- Decision Packets

### COMMUNITIES OWNS

- Source operation
- Recurring recognition programs
- Identity resolution operations
- Obligation operations
- Settlement readiness

### EARN OWNS

- Contributor earnings experience
- Creator campaign performance
- Recognized, pending, claimable and settled earning history

Capital may summarize claimable value.

Profile may show whether a payout destination is ready.

Neither should duplicate the full Earn interface.

---

## FIRST TASK — REPOSITORY AUDIT

Before editing, inspect the current implementation.

Locate the actual current paths for:

- Capital route
- Profile route
- PaymentsOS
- ResolveBanking
- Capital state API
- Capital overview API
- Capital wallet resolution
- Arc RPC client
- Circle wallet resolution
- wallet-slice generation
- active wallet selection
- Arc balance snapshots
- WalletBalanceSync
- useResolveAccount
- useSpendableUsd
- AuthProvider balance logic
- capital refresh event bus
- pending-transaction reconciliation
- profile bootstrap API
- profile state API
- connection-state provider
- ProfileSettings
- Profile work/identity components
- OAuth return handlers
- payout destination handlers
- React Query keys
- Redis/Upstash cache utilities
- route loading files
- global authenticated layout

Known likely areas include:

```text
src/components/resolve/payments/payments-os.tsx
src/components/resolve/payments/resolve-banking.tsx
src/components/resolve/capital/**
src/components/resolve/profile/**
src/components/auth/auth-provider.tsx
src/components/resolve/wallet-balance-sync.tsx

src/hooks/use-resolve-account.ts
src/hooks/use-spendable-usd.ts
src/hooks/use-active-wallet-view.ts

src/lib/capital/**
src/lib/banking/**
src/lib/profile/**
src/lib/wallet/**
src/lib/query/**
src/lib/cache/**

src/app/api/capital/**
src/app/api/profile/**
src/app/api/wallet/**
```

Locate the real current paths before editing.

Create:

```text
docs/CAPITAL-PROFILE-AUDIT.md
```

Record:

- Initial requests made by Capital
- Initial requests made by Profile
- Duplicate requests
- Mount-time live RPC requests
- Pollers
- Request timeouts
- Cache layers
- Wallet address sources
- Balance read methods
- Balance decimal conversion
- Connector state sources
- Broad cache invalidations
- Current client-component boundaries
- Largest client bundles
- Controls without real actions
- Stale or conflicting state paths

Do not create only the document and stop.

---

## PHASE 1 — ARC BALANCE CORRECTNESS

This is the first implementation phase.

Do not redesign Capital until wallet state is correct.

### 1. One canonical wallet registry

Create or consolidate one authoritative wallet resolver.

Suggested result:

```ts
type ResolvedUserWallets = {
  appWallet: {
    walletId: string;
    address: `0x${string}`;
    provider:
      | "circle_developer_controlled"
      | "circle_user_controlled"
      | "resolve";
  } | null;

  connectedWallet: {
    address: `0x${string}`;
    connector:
      | "walletconnect"
      | "reown"
      | "injected"
      | "other";
  } | null;

  payoutWallet: {
    address: `0x${string}`;
    verificationState:
      | "unverified"
      | "pending"
      | "verified";
  } | null;

  selectedCapitalWallet:
    | "app"
    | "connected";

  updatedAt: string;
};
```

Rules:

- Never resolve different wallet addresses independently inside different tabs.
- Profile and Capital must read the same wallet records.
- Do not generate another wallet because one read failed.
- Do not fall back to an unrelated wallet address.
- Selected wallet choice must persist server-side or in a stable user setting.
- Payout wallet and transaction-source wallet are different concepts.
- Do not automatically make a connected wallet the payout destination.
- Do not automatically sum balances from separate wallet addresses.

### 2. Arc’s two USDC interfaces are one balance

Arc Testnet configuration:

chain ID:
`5042002`

Primary RPC:
`https://rpc.testnet.arc.network`

Official fallbacks:

```text
https://rpc.blockdaemon.testnet.arc.network
https://rpc.drpc.testnet.arc.network
https://rpc.quicknode.testnet.arc.network
```

WebSocket:
`wss://rpc.testnet.arc.network`

Use:

```ts
import { arcTestnet } from "viem/chains";
```

Arc native USDC:

- 18 decimals
- Returned by native balance reads such as viem `getBalance`

Arc ERC-20 USDC interface:

- 6 decimals
- Used for transfer, approval and allowance operations
- Contract:
  `0x3600000000000000000000000000000000000000`

These are two interfaces over one underlying balance.

Never do:

```text
nativeBalance + erc20Balance
```

Never display them as two separate assets.

Never compare raw 18-decimal and 6-decimal values.

Choose one canonical display read:

Preferred:
viem `getBalance` using Arc native balance and `formatUnits(value, 18)`

Optional diagnostic:
ERC-20 `balanceOf` with 6 decimals

When both succeed:

- Normalize both into micro-USDC or decimal USDC.
- Confirm they agree within expected truncation.
- Do not add them.
- Record a diagnostic mismatch only when materially different.

Create one helper:

```ts
type ArcBalanceRead = {
  walletAddress: `0x${string}`;
  chainId: 5042002;

  amountMicroUsdc: bigint;

  source:
    | "native_rpc"
    | "erc20_rpc"
    | "circle_api"
    | "database_snapshot"
    | "browser_snapshot";

  freshness:
    | "live"
    | "recent"
    | "stale"
    | "unknown";

  provider?: string;
  blockNumber?: bigint;
  readAt: string;

  diagnostic?: {
    nativeMicroUsdc?: bigint;
    erc20MicroUsdc?: bigint;
    mismatch?: boolean;
  };
};
```

Store money using integer micro-USDC or the repository’s tested decimal implementation.

Do not store new financial values as JavaScript floats.

### 3. Provider router

Create or consolidate:

```text
src/lib/arc/rpc-router.ts
```

Behavior:

1. Try the configured primary RPC.
2. Timeout each provider after approximately 2.5–3 seconds.
3. Rotate through official fallback providers.
4. Return the first valid response.
5. Record provider latency and failure internally.
6. Do not expose raw RPC errors as the main user message.
7. Coalesce simultaneous reads for the same chain + wallet + requested block state.
8. Apply exponential backoff after repeated provider failure.
9. Do not send four parallel RPC reads on every render.
10. Do not perform a live read when a recent in-flight read already exists.

Suggested response:

```ts
type ArcRpcResult<T> =
  | {
      ok: true;
      data: T;
      provider: string;
      latencyMs: number;
      blockNumber?: bigint;
    }
  | {
      ok: false;
      code:
        | "all_providers_unavailable"
        | "timeout"
        | "invalid_response"
        | "wrong_chain";
      retryAfterMs: number;
    };
```

### 4. Separate balance state from network-health state

A provider failure must not set a valid cached balance to zero.

Represent separately:

```ts
type CapitalBalanceState = {
  value: ArcBalanceRead | null;

  syncState:
    | "idle"
    | "syncing"
    | "live"
    | "cached"
    | "stale"
    | "failed";

  networkHealth:
    | "healthy"
    | "degraded"
    | "unavailable"
    | "unknown";

  lastSuccessfulSyncAt: string | null;
  currentAttemptStartedAt: string | null;
  errorCode?: string;
};
```

Correct user experience:

```text
$64.92
Last confirmed 3 minutes ago
Arc live sync temporarily unavailable
```

Incorrect:

```text
Arc connection failed
$0.00
```

unless the last confirmed balance was truly zero.

### 5. Do not let one wallet overwrite another

App wallet and connected wallet must have separate snapshots.

```ts
type WalletBalanceSlice = {
  walletType: "app" | "connected";
  address: `0x${string}`;
  amountMicroUsdc: bigint;
  freshness: string;
  readAt: string;
  provider?: string;
};
```

The selected wallet controls:

- Available-balance display
- Add/send action
- Settlement source
- Fee preview

Do not label a combined amount as the balance of one address.

A combined portfolio total may appear separately:

```text
Portfolio total
App wallet + connected wallet
```

It must never be called:

```text
Available to spend
```

unless the application can spend both in the current operation.

### 6. Fast bootstrap

Create or consolidate:

```text
GET /api/capital/bootstrap
```

This must return useful persisted state without waiting for Arc RPC.

Response:

```ts
type CapitalBootstrap = {
  ok: true;

  wallets: ResolvedUserWallets;

  balances: {
    app: WalletBalanceSlice | null;
    connected: WalletBalanceSlice | null;
    selected: WalletBalanceSlice | null;
    portfolioTotalMicroUsdc: string;
  };

  moneyState: {
    availableMicroUsdc: string;
    reservedMicroUsdc: string;
    committedMicroUsdc: string;
    pendingMicroUsdc: string;
    claimableMicroUsdc: string;
    settledThirtyDayMicroUsdc: string;
  };

  authorizations: CapitalAuthorizationSummary[];
  settlementQueue: SettlementSummary[];
  recentActivity: CapitalActivitySummary[];
  guardrails: CapitalGuardrailSummary | null;

  sync: {
    balanceState: "live" | "recent" | "stale" | "unknown";
    lastSuccessfulSyncAt: string | null;
    liveSyncRecommended: boolean;
  };

  generatedAt: string;
};
```

The endpoint should read:

1. Database snapshot
2. Redis/Upstash snapshot
3. Browser snapshot only as a temporary UI fallback

It must not block on:

- Arc RPC
- Circle enrichment
- transaction-history indexing
- all connector checks
- full obligation loading

Target:

useful response under 500–700 ms in normal conditions.

### 7. Background sync endpoint

Create or consolidate:

```text
POST /api/capital/sync
```

Input:

```ts
type CapitalSyncRequest = {
  walletTypes?: Array<"app" | "connected">;
  reason:
    | "manual_refresh"
    | "transaction_submitted"
    | "transaction_confirmed"
    | "window_focus"
    | "scheduled";
  idempotencyKey: string;
};
```

Behavior:

- Immediately return an accepted ActionRun.
- Dedupe concurrent syncs.
- Read wallet balances through the provider router.
- Reconcile pending transactions.
- Persist successful snapshots.
- Preserve previous snapshots on failure.
- Update only Capital-related query keys.
- Never zero the wallet on failure.
- Never trigger a second sync while one is active.
- Do not automatically retry forever.

Opening Capital must use bootstrap only.

After first render, a background sync may begin only when:

- the snapshot is stale;
- a transaction was recently submitted;
- the user manually refreshes;
- the tab returns to focus after a meaningful interval.

Do not run live Arc RPC merely because React mounted a component.

### 8. Polling policy

Remove duplicate pollers.

Use one coordinated process.

Recommended:

- No repeated full Capital-state polling.
- Recent cached state may be checked every 45–60 seconds while visible.
- Live Arc sync at a slower interval only when:
  - Capital is visible;
  - a pending transaction exists;
  - or the snapshot is stale.
- Stop timers when document visibility is hidden.
- Reconcile immediately after transaction submission.
- Prefer WebSocket or receipt-specific polling for pending transactions.
- Do not read all wallet state to confirm one transaction.

---

## PHASE 2 — CAPITAL PERFORMANCE

### 1. Server shell and client islands

Do not make the entire Capital page one giant client component.

Server-render:

- Route shell
- Header
- Known summary
- Section structure
- Cached bootstrap payload where supported

Use client components only for:

- Wallet source selector
- Add/send dialogs
- Refresh action
- Authorizations
- Settlement approval
- Filters
- Live transaction state

Use Suspense for:

- Decision Inbox
- Settlement Queue
- Activity
- Technical details

Do not make the header wait for Activity or Arc.

### 2. React Query policy

Use the existing TanStack React Query setup.

Suggested query keys:

```text
capital.bootstrap
capital.balance.wallet(appAddress)
capital.balance.wallet(connectedAddress)
capital.authorizations
capital.settlements
capital.activity
capital.guardrails
capital.receipt(receiptId)
```

Suggested stale times:

```text
capital.bootstrap: 15 seconds
individual wallet balance snapshot: 15–30 seconds
authorizations: 15 seconds
settlements while pending: 5 seconds
confirmed receipts: Infinity
guardrails: 5 minutes
```

Rules:

- Preserve previous data during refresh.
- Use `placeholderData` for bootstrap.
- Do not refetch on every component mount.
- Do not refetch on every tab switch when state is recent.
- Do not invalidate the complete Capital namespace after a small mutation.
- Update the affected record optimistically.
- Reconcile after the server confirms.
- Remove duplicate manual fetch plus React Query fetch paths.

### 3. Route navigation

Add or repair:

```text
src/app/.../capital/loading.tsx
```

The skeleton must match the new Capital structure.

Keep global navigation mounted.

Use `next/link`.

Show route-transition feedback in under 100 ms.

Do not use a central spinner.

---

## PHASE 3 — CAPITAL UI/UX REBUILD

### CAPITAL DESIGN IDENTITY

Capital should feel like:

A controlled stablecoin treasury and settlement command center.

It must not feel like:

- A retail banking page
- A crypto exchange
- A generic wallet
- A Home marketing section
- A documentation page
- A list of educational cards

Visual language:

- Deep obsidian/navy background
- Violet for authorization and policy
- Electric blue for capital routing
- Cyan for connected infrastructure
- Amber for awaiting approval or reconciliation
- Mint only for confirmed settlement
- Rose only for real rejection or failure
- Fine technical grid
- Thin flow lines
- Restrained glow
- Layered operational surfaces
- High information density with clear hierarchy

Suggested tokens:

```css
--capital-bg: #030711;
--capital-bg-deep: #02050c;
--capital-surface: #071220;
--capital-surface-raised: #0b192a;
--capital-surface-focus: #102139;

--capital-border-soft: rgba(130, 153, 195, 0.12);
--capital-border: rgba(130, 153, 195, 0.20);
--capital-border-active: rgba(79, 166, 255, 0.46);

--capital-text: #f5f8fc;
--capital-secondary: #a6b4c8;
--capital-muted: #71839b;

--capital-violet: #8364ff;
--capital-blue: #399cff;
--capital-cyan: #35d1ef;
--capital-mint: #42d6aa;
--capital-amber: #e4b55a;
--capital-rose: #ea7186;
```

Do not place a gradient on every card.

### 1. Full-width command layout

Use a main content width around:

```text
1380–1480px
```

Do not retain the current narrow centered column.

Page structure:

1. Capital command header
2. Capital Pulse
3. Operational action dock
4. Decision Inbox
5. Settlement Queue
6. Treasury Guardrails
7. Activity and receipts
8. Collapsed infrastructure diagnostics

### 2. Compact command header

Maximum height:

```text
150–180px
```

Structure:

```text
CAPITAL

Control what can move, why it can move, and where it settles.

Arc Testnet · Selected wallet: RESOLVE wallet
Last confirmed balance: 3m ago · 2 settlements pending

[Add USDC] [Send] [Refresh] […]
```

Do not place large balance cards in the header.

Do not display raw provider errors here.

### 3. Capital Pulse

Create one premium main operating surface.

Left:

```text
SELECTED WALLET

RESOLVE wallet
0x5945…68d4

Available       $64.92
Reserved        $25.00
Committed       $400.65
Claimable       $0.00
Pending         $50.00

Last confirmed:
3 minutes ago

[Change wallet]
```

Right:

Create a lightweight operational diagram:

```text
Wallet
→ Decision Inbox
→ Authorized obligations
→ Settlement batch
→ Arc confirmation
→ Receipt
```

Every diagram node uses real data.

Example:

```text
WALLET
$64.92 available

DECISION INBOX
2 packages

OBLIGATIONS
18 ready

SETTLEMENT
1 pending

RECEIPTS
7 confirmed
```

Interactions:

- Wallet opens wallet details.
- Decision Inbox scrolls or switches to Authorizations.
- Obligations open the selected authorization package.
- Settlement opens pending transaction.
- Receipt opens Activity/Receipts.

Do not animate empty paths.

Pulse only an actually pending path.

Maximum visual height:

```text
260–320px
```

### 4. Capital navigation

Replace Overview/Activity-only navigation with:

```text
Overview
Authorizations
Settlements
Activity
```

Overview:
Summary and next actions

Authorizations:
Decision Inbox and preflight

Settlements:
Settlement packages and chain state

Activity:
Confirmed, pending, rejected, reversed and claim activity

Do not create route reloads for local tabs.

Preserve tab in URL:

```text
?view=authorizations
?view=settlements
?view=activity
```

### 5. Operational action dock

Actions:

```text
Add USDC
Send USDC
Review authorizations
Run preflight
Collect earnings
```

Only show Collect earnings as primary when claimable value exists.

Each control must show:

- Exact operation
- Pending state
- Result
- Failure recovery
- Action ID
- Test ID

Do not use full-width buttons on desktop.

### 6. Decision Inbox

Replace repetitive pending-obligation lists.

Group authorizations by:

- Program
- Community
- Campaign
- Blueprint
- Policy version

Row:

```text
[origin icon] React Documentation Program

Origin:
Communities

Requested:
$125.00

Obligations:
5 contributors

Evidence:
Direct GitHub records

Policy:
Documentation v3

State:
Needs preflight

[Review package] [Run preflight] […]
```

Expanded view:

- Payees
- Individual amounts
- Evidence references
- Identity readiness
- Payout destinations
- Policy
- Total
- Content hash
- Created by
- Previous simulations
- Blocking conditions

Do not render 23 identical `$25` records as the primary page structure.

### 7. Deterministic settlement preflight

Preflight checks:

- Authorization package exists
- Package is not superseded
- Policy version matches
- Blueprint totals reconcile
- Obligations are not duplicated
- All required identities are resolved
- All required payout destinations exist
- Selected wallet has sufficient balance
- Treasury reserve remains
- Arc chain is correct
- Transaction is not already completed
- Idempotency key is unused
- Environment configuration exists

Persist preflight result.

States:

```text
ready
blocked
stale
already_settled
```

Display checks as a clear checklist, not a readiness percentage.

### 8. Settlement Queue

Settlement states:

```text
Awaiting approval
Ready
Submitting
Pending Arc
Confirmed
Partially confirmed
Reconciliation required
Rejected
Reversed
```

Each record shows:

- Program/campaign
- Total
- Payees
- Selected wallet
- Transaction hash
- Submitted time
- Last chain event
- Current state
- Recovery action

Primary action must depend on state:

```text
Run preflight
Approve
Open pending transaction
Resume reconciliation
Open receipt
```

### 9. Treasury Guardrails

Use one compact configurable panel.

Settings:

- Minimum reserve
- Maximum authorization
- Daily movement cap
- Maximum agent purchase
- Allowed wallet sources
- Allowed chain IDs
- Require verified identity
- Minimum evidence state
- Auto-approval threshold
- Auto-settlement setting
- Policy expiration

Persist and version changes.

Do not add decorative switches without server mutation.

### 10. Activity and receipts

Filters:

```text
All
Deposits
Sends
Authorizations
Commitments
Settlements
Claims
Reconciliation
```

Each row:

- Event
- Amount
- Wallet
- Program/campaign
- Status
- Time
- Arc transaction
- Receipt
- Error or reconciliation reason

Confirmed receipts use immutable query caching.

### 11. Remove misplaced content

Remove these blocks from Capital:

- How money moves
- Creators & contributors education
- Any funder education
- Funder/operator education
- Community operator education
- RESOLVE rail marketing text

Move reusable explanations to:

- Home
- Product guide
- Documentation
- Empty-state help drawer

Capital should prioritize operations.

---

## PHASE 4 — PROFILE PERFORMANCE

### 1. Consolidated Profile bootstrap

Create or consolidate:

```text
GET /api/profile/bootstrap
```

Initial payload:

```ts
type ProfileBootstrap = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    handle: string | null;
  };

  readiness: {
    identityReady: boolean;
    sourceReady: boolean;
    payoutReady: boolean;
    securityReady: boolean;
    blockers: ProfileBlocker[];
  };

  identities: ProfileIdentitySummary[];
  connections: ProfileConnectionSummary[];

  wallets: {
    appWallet: ProfileWalletSummary | null;
    connectedWallet: ProfileWalletSummary | null;
    payoutDestination: ProfileWalletSummary | null;
  };

  security: {
    activeSessions: number;
    lastSignInAt: string | null;
    twoFactorConfigured: boolean | null;
  };

  freshness: {
    generatedAt: string;
    connectionState: "live" | "recent" | "stale";
  };
};
```

Initial bootstrap must use persisted connection state.

Do not live-check every external provider before rendering Profile.

### 2. Background connector health

External connection health should refresh individually.

Do not perform:

```text
GitHub
+ ListenBrainz
+ MusicBrainz
+ Navidrome
+ Jellyfin
+ OpenAlex
+ every other connector
```

all before the page becomes usable.

Each connector has:

- persisted state;
- last successful synchronization;
- authentication expiry;
- health;
- manual refresh action.

Only refresh:

- visible expanded connector;
- recently expired connector;
- manually selected connector;
- connector returning from OAuth.

### 3. One connection-state source

Profile, Discover, Mission, Communities and Earn must read one shared connection-state model.

Never allow:

```text
Profile: GitHub connected
Mission: GitHub disconnected
```

because separate API calls completed in a different order.

Merge rules:

- A slower stale response cannot downgrade a newer confirmed connection.
- Explicit disconnect may downgrade state.
- OAuth callback updates the canonical connection record.
- Query cache updates immediately.
- Cross-tab consumers receive the same new state.

### 4. OAuth return path

Every connect/reconnect action must preserve:

```text
returnTo
```

Example:

```text
/profile?view=sources&connector=github&returnTo=/communities/react
```

After OAuth:

- Persist connection
- Update shared query cache
- Return to the correct Profile section
- Show the exact completed state
- Offer return to the originating workflow

Do not lose user context.

### 5. Route and bundle speed

- Server-render Profile shell.
- Add matching `loading.tsx` skeleton.
- Lazy-load provider-specific details.
- Lazy-load session history.
- Do not load work history in Profile.
- Do not load full earnings history in Profile.
- Do not call Capital bootstrap merely to render identity settings.
- Prefetch Profile bootstrap on avatar hover or navigation intent.
- Preserve previous Profile state during background refresh.

---

## PHASE 5 — PROFILE UI/UX REBUILD

### PROFILE DESIGN IDENTITY

Profile should feel like:

A secure identity and connection control plane.

It must not feel like:

- A social profile
- A creator dashboard
- A wallet dashboard
- Another Communities page
- A list of OAuth buttons
- A settings form dumped onto one page

Visual identity:

- Deep graphite/navy base
- Violet for RESOLVE identity
- Cyan for connected sources
- Blue for verified identity
- Mint for payout readiness
- Amber for setup needed
- Rose for permission or security attention
- Thin identity-link lines
- Clean technical surfaces
- Less financially styled than Capital

Suggested tokens:

```css
--profile-bg: #040811;
--profile-surface: #091321;
--profile-surface-raised: #0d1b2b;
--profile-surface-focus: #112238;

--profile-border-soft: rgba(139, 158, 194, 0.12);
--profile-border: rgba(139, 158, 194, 0.21);

--profile-text: #f4f7fb;
--profile-secondary: #a4b3c7;
--profile-muted: #718299;

--profile-violet: #8267f4;
--profile-blue: #4a9cff;
--profile-cyan: #38cfdd;
--profile-mint: #42d5a8;
--profile-amber: #e4b45a;
--profile-rose: #eb7288;
```

### 1. Compact Profile header

Structure:

```text
[avatar] Muhammad Abdullah

@abdullahlp114
abdullahlp114@gmail.com

Identity control plane for work attribution, connected sources and payouts.

Verified account
3 connected sources
Payout destination ready

[Edit identity] [Manage security] […]
```

Maximum height:

```text
160–190px
```

Do not use a large empty profile hero.

### 2. Profile sections

Use these tabs:

```text
Overview
Identities
Sources
Wallets & Payouts
Access & Security
Activity
```

OVERVIEW

- Account readiness
- Identity network
- Current blockers
- Connected-source summary
- Wallet/payout summary
- Recent account activity

IDENTITIES

- GitHub identity
- Music identities
- Research identities
- Media identities
- Community identities
- Identity claims
- Verification and conflicts

SOURCES

- Connected service accounts
- Synchronization state
- Permissions
- Reauthorization
- Technical details

WALLETS & PAYOUTS

- RESOLVE wallet
- Connected wallet
- Default payout destination
- Verification status
- Supported settlement network
- Change/default controls

ACCESS & SECURITY

- Active sessions
- Login methods
- OAuth access
- API/agent permissions
- Data visibility
- Export
- Account deletion

ACTIVITY

- Identity connected
- Identity verified
- Source synchronized
- Wallet linked
- Payout destination changed
- Permission revoked
- Session closed

Do not place earnings, pools, programs, or settlements here.

### 3. Account Readiness Map

Create one compact interactive diagram:

```text
ACCOUNT
   ↓
IDENTITIES
GitHub verified · Music identity missing
   ↓
SOURCES
3 connected · 1 needs reauthorization
   ↓
PAYOUT
Arc destination verified
   ↓
READY
Eligible for supported programs
```

Use actual state.

Click nodes:

- Identities → Identities tab
- Sources → Sources tab
- Payout → Wallets & Payouts
- Security → Access & Security

Do not use a fake readiness score.

Show exact blockers:

- GitHub identity is not verified.
- MusicBrainz artist identity is unresolved.
- Payout destination has not been confirmed.
- ListenBrainz authorization expired.

Maximum height:

```text
200–240px
```

### 4. Identity Network

Create a compact relationship visual:

```text
RESOLVE ACCOUNT
   ├── GitHub: @username
   ├── ListenBrainz: @username
   ├── MusicBrainz: Artist MBID
   ├── OpenAlex: Author ID
   ├── Jellyfin: Local profile
   └── Arc payout: 0x…
```

Each node shows:

```text
connected
verified
candidate
conflicted
expired
not connected
```

The diagram represents identity relationships.

It must not display fake social metrics.

### 5. Identity records

Each identity row:

```text
[provider icon] GitHub

Account:
@username

Purpose:
Code contribution attribution

State:
Connected · verified

Last checked:
12 minutes ago

Used by:
React documentation program
2 active campaigns

[Manage] [View evidence] […]
```

Only show “Used by” from real records.

Unresolved identity:

```text
MusicBrainz artist

Observed:
Artist name

Candidate:
MBID ...

State:
Needs confirmation

[Review match]
```

### 6. Source connection cards

Group sources:

WORK

- GitHub
- Open Collective
- RSS

MUSIC & MEDIA

- ListenBrainz
- MusicBrainz
- Navidrome
- Jellyfin
- Owncast
- PeerTube

RESEARCH

- OpenAlex
- Crossref
- ORCID where actually implemented

COMMUNITY

- Supported community services

Do not show unsupported integrations as connected.

Each card:

```text
Provider
Connected account
Purpose
Health
Last sync
Permissions
Programs using it
One primary action
One secondary action
More
```

State-aware actions:

```text
Not connected: [Connect]
Connected: [Manage]
Expired: [Reconnect]
Sync failed: [Retry sync]
Healthy: [Open details]
```

Maximum visible:

one primary
one secondary
overflow

### 7. Wallets and payouts

Keep the concepts separate.

RESOLVE WALLET

```text
Used for:
Application-managed Arc operations

Address:
0x...

State:
Active

[View on ArcScan] [Copy]
```

CONNECTED WALLET

```text
Used for:
User-signed actions

Address:
0x...

State:
Connected

[Manage connection]
```

PAYOUT DESTINATION

```text
Used for:
Receiving contributor or creator settlement

Address:
0x...

State:
Verified

[Change destination] [Verify]
```

Do not show balances here.

Balances belong to Capital.

Profile may link to:

```text
[Open Capital]
```

Changing a payout address requires:

- explicit confirmation;
- verification where supported;
- audit event;
- no silent replacement;
- warning when unsettled obligations exist.

### 8. Security and permissions

Create clear records for:

- Active sessions
- Last sign-in
- Authentication method
- Connected OAuth providers
- Granted scopes
- Agent spending permissions
- External write permissions
- Public Profile visibility
- Contribution Passport visibility
- Data export
- Account deletion

Actions must be real:

```text
Revoke session
Revoke provider permission
Change visibility
Export data
Delete account
```

High-risk actions require confirmation.

Do not show secret values.

### 9. Profile activity ledger

Only account-level activity:

- GitHub connected
- ListenBrainz reauthorized
- Identity match confirmed
- Wallet linked
- Payout destination changed
- OAuth permission revoked
- Session closed
- Data export requested

Do not duplicate Capital transaction activity.

---

## PHASE 6 — ACTION REGISTRY

Every Capital and Profile control must use a typed registered action.

### CAPITAL ACTIONS

```text
capital.refresh_snapshot
capital.select_wallet
capital.add_usdc
capital.send_usdc
capital.collect_earnings

capital.review_authorization
capital.run_preflight
capital.approve_package
capital.reject_package
capital.return_package

capital.submit_settlement
capital.open_transaction
capital.resume_reconciliation
capital.retry_safe_step
capital.open_receipt
capital.export_receipt

capital.update_guardrails
```

### PROFILE ACTIONS

```text
profile.update_identity
profile.connect_source
profile.reconnect_source
profile.disconnect_source
profile.sync_source
profile.open_source_details

profile.claim_identity
profile.confirm_identity
profile.reject_identity
profile.submit_identity_evidence

profile.link_wallet
profile.unlink_wallet
profile.set_payout_destination
profile.verify_payout_destination

profile.revoke_session
profile.revoke_permission
profile.update_visibility
profile.export_data
profile.delete_account
```

Each action must include:

- Registered action ID
- Zod input schema
- Required role
- Preconditions
- Explanation
- Expected result
- Immediate pending state
- Persisted ActionRun
- Idempotency key for mutations
- Real mutation or artifact
- Exact query-key updates
- Error recovery
- Accessible label
- `data-testid`
- Audit event

No action may:

- return only a toast;
- only update temporary React state;
- infer behavior from its visible label;
- claim success before persistence;
- claim chain completion before confirmation;
- create duplicate transactions after double-clicking.

---

## PHASE 7 — LOADING, FAILURE AND EMPTY STATES

### CAPITAL CACHED STATE

```text
$64.92 available

Last confirmed:
3 minutes ago

Arc live synchronization is temporarily delayed.

[Retry live sync]
```

Do not replace it with $0.

### CAPITAL NO WALLET

```text
No Capital wallet is available.

Create or link a supported Arc wallet before moving value.

[Set up wallet]
```

### CAPITAL EMPTY INBOX

```text
No authorization packages need review.

Approved Mission and Communities packages will appear here.

[Open Communities] [Open Mission]
```

### PROFILE LOADING

Keep:

- Header
- Tabs
- Cached identity state
- Known connections

visible.

Show structural skeletons only for unknown sections.

### PROFILE CONNECTION FAILURE

```text
GitHub connection remains recorded.

Live health check did not complete.

Last successful synchronization:
2 hours ago

[Retry] [Manage access]
```

Do not label it disconnected unless the canonical connection was revoked.

---

## PHASE 8 — RESPONSIVE AND ACCESSIBILITY

### DESKTOP

Capital:

- Full bento command layout
- Decision Inbox and Settlement Queue side by side where practical

Profile:

- Account Readiness Map plus current blockers
- Tabs and dense operational records

### TABLET

- Two-column summaries
- Stacked detailed sections
- No squeezed data tables

### MOBILE

Capital:

- Selected wallet and available value first
- Compact sticky action dock
- Authorizations as cards
- Settlement detail in sheet
- No horizontal overflow

Profile:

- Identity readiness first
- Tabs horizontally scrollable
- Connector cards stacked
- Security details in sheets
- Minimum 44px controls

### ACCESSIBILITY

- Keyboard navigation
- Visible focus
- No color-only status
- `aria-live` for balance and transaction updates
- Reduced-motion support
- Correct dialog focus trapping
- Proper table semantics
- Screen-reader status labels
- No raw wallet address as the only accessible label

---

## PHASE 9 — TESTING

### UNIT TESTS

- Arc provider failover
- Native USDC decimal conversion
- ERC-20 USDC decimal conversion
- Native/ERC-20 reconciliation
- No native plus ERC-20 double counting
- Selected wallet calculation
- Portfolio-total calculation
- Cached-balance preservation
- Wallet resolver
- Capital money-state calculation
- Guardrail validation
- Preflight checks
- Connector-state merging
- OAuth return-path generation
- Identity readiness blockers
- Action idempotency

### INTEGRATION TESTS

1. Capital bootstrap returns persisted state without Arc RPC.
2. Background sync updates a wallet snapshot.
3. Arc provider failure keeps the last balance.
4. App and connected wallets remain separate.
5. Selecting connected wallet changes available balance correctly.
6. A live result cannot be overwritten by an older cached result.
7. A stale API response cannot downgrade a connected Profile source.
8. Disconnect explicitly changes canonical state.
9. OAuth completion updates all tabs.
10. Payout destination changes create an audit event.
11. Preflight blocks insufficient balance.
12. Preflight blocks unresolved payout identity.
13. Confirmed settlement creates a receipt.
14. Failed settlement enters reconciliation.

### PLAYWRIGHT FLOW A — CAPITAL FAST LOAD

```text
Sign in
→ Open Capital
→ Cached shell and values appear
→ No live Arc RPC blocks first useful render
→ Background sync begins
→ Values update without blanking the page
```

### PLAYWRIGHT FLOW B — RPC FAILURE

```text
Load a valid cached wallet balance
→ Simulate all Arc RPC providers failing
→ Capital retains cached amount
→ Network state becomes degraded
→ Retry action appears
→ No value changes to zero
```

### PLAYWRIGHT FLOW C — WALLET SELECTION

```text
Open Capital
→ Select RESOLVE wallet
→ Display only RESOLVE wallet spendable amount
→ Select connected wallet
→ Display only connected-wallet spendable amount
→ Portfolio total remains separate
```

### PLAYWRIGHT FLOW D — AUTHORIZATION

```text
Open Decision Inbox
→ Review package
→ Run preflight
→ Inspect payees and evidence
→ Approve
→ Submit
→ Pending Arc state
→ Confirm
→ Receipt available
```

### PLAYWRIGHT FLOW E — PROFILE CONNECTION

```text
Open Profile
→ Cached identities appear immediately
→ Connect or reconnect GitHub
→ OAuth returns to Profile
→ State updates without flicker
→ Communities and Mission read the same state
```

### PLAYWRIGHT FLOW F — PAYOUT DESTINATION

```text
Open Wallets & Payouts
→ Set destination
→ Confirm
→ Audit event appears
→ Eligible obligation reads updated destination
```

### PERFORMANCE TARGETS

- Navigation feedback under 100ms
- Cached Capital shell under 300ms on warm navigation
- Useful Capital bootstrap under 700ms
- Useful Profile bootstrap under 700ms
- Action pending state under 150ms
- No live Arc RPC blocking initial Capital render
- No full-page spinner
- No duplicate Capital bootstrap during one navigation
- No connector stampede on Profile load
- No balance flash from value to zero
- No broad application-cache invalidation after a small mutation

Measure actual results.

Do not invent timings.

---

## IMPLEMENTATION ORDER

Commit 1:
Audit and Arc balance correctness

Commit 2:
Capital bootstrap, sync and performance consolidation

Commit 3:
Capital command-center redesign

Commit 4:
Profile bootstrap and connection-state consolidation

Commit 5:
Profile identity-control-plane redesign

Commit 6:
Typed actions, responsive work and accessibility

Commit 7:
Tests, performance report and regression fixes

Do not run a full production build after every small edit.

Use:

1. Targeted type checking/tests
2. Relevant integration tests
3. Full checks after each major commit
4. One final production build

Do not deploy.

---

## FINAL ACCEPTANCE CRITERIA

### CAPITAL

1. Capital no longer uses a narrow wallet-page layout.
2. Educational marketing blocks are removed.
3. Cached balance appears before live Arc synchronization.
4. RPC failure cannot turn a confirmed non-zero balance into zero.
5. Network health is separate from balance value.
6. Native and ERC-20 USDC are not double-counted.
7. App and connected wallet amounts remain separate.
8. Selected wallet determines available spendable value.
9. Portfolio total is labelled separately.
10. Opening Capital does not force a live RPC read.
11. Live sync uses official provider fallback.
12. Concurrent sync calls are deduplicated.
13. Decision Inbox groups obligations meaningfully.
14. Settlement preflight is real and persisted.
15. Settlement Queue exposes real chain states.
16. Guardrails are real and versioned.
17. Activity uses real transaction and receipt references.
18. Every button executes a typed action.
19. No chain success appears before confirmation.
20. Capital is fast, responsive and accessible.

### PROFILE

21. Profile has a distinct identity-control-plane design.
22. Profile loads from one consolidated bootstrap.
23. External connector checks do not block initial rendering.
24. All tabs read the same connection state.
25. Stale responses cannot downgrade fresh connection state.
26. Account readiness shows exact blockers, not a score.
27. Identity relationships are understandable.
28. Source connections are grouped and state-aware.
29. Wallet source and payout destination are separated.
30. Profile does not duplicate balances or earnings.
31. OAuth returns preserve user context.
32. Security and permission controls are real.
33. High-risk actions require confirmation.
34. Activity records account events without duplicating Capital.
35. Profile is fast, responsive and accessible.

### SYSTEM

36. Existing authentication continues to work.
37. Existing Arc/Circle transaction logic remains compatible.
38. Existing Mission and Communities handoffs remain valid.
39. No secret is printed.
40. No fake data is introduced.
41. No Vercel deployment is triggered.
42. All changes remain on `codex/post-release-hardening`.

---

## FINAL CODEX REPORT

Return:

- Branch used
- Architecture summary
- Exact files changed
- Arc balance root cause found
- Balance-decimal implementation
- Provider-fallback implementation
- Requests removed or consolidated
- Capital before/after structure
- Profile before/after structure
- Actions implemented
- Database changes
- Environment-variable names required, without values
- Unit-test results
- Integration-test results
- Playwright results
- TypeScript result
- Lint result
- Production-build result
- Measured before/after timings
- Remaining limitations
- Whether the branch is ready for one later squash release and controlled Vercel deployment

Do not report completion when:

- Capital still waits for Arc on first render;
- a failed live request still replaces cached value with zero;
- the two Arc USDC interfaces are added together;
- connector states still disagree across tabs;
- important buttons remain cosmetic;
- or the tests were not actually executed.
