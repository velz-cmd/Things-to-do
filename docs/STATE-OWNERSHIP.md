# State Ownership

The database and confirmed chain state are authoritative. React Query is the shared browser projection; component state is reserved for transient presentation such as an open sheet, selected tab, draft input, or optimistic lifecycle.

| State | Canonical owner | Read surfaces | Mutation owner | Required invalidation |
|---|---|---|---|---|
| Auth session | Supabase | All signed-in tabs | Auth routes/provider | Profile, Capital, Communities, Mission |
| User identity and connectors | Profile database/API | Profile, Communities, Mission context, Discover personalization | Profile connector routes | `profile-state`, `profile-bootstrap`, `communities`, relevant Discover feed |
| Payout destination | Profile | Profile, Communities Identity Desk, Capital claim/settlement | Profile payout action | Profile, Communities, Capital |
| Community installation | Communities database | Communities, Profile summary, Discover installed state | `community.install` | Communities list/surface, Profile, Discover |
| Source connection | Profile | Profile and Communities Sources | Profile connector actions | Profile and Communities |
| Source sync run and evidence | Communities | Communities, Mission evidence context | `source.sync` | Community surface, Mission context |
| Program/policy | Communities | Communities, Discover active programs, Mission simulation | Program actions | Community surface, Communities list, Discover |
| Mission session/turn | Mission | Mission | Mission actions | Mission session/history |
| Blueprint and simulation | Mission | Mission, Communities readiness, Capital handoff | Mission actions | Mission, Community surface, Capital |
| Obligation | Communities | Communities, Mission decision map, Capital settlement package | Authorization/obligation actions | Community surface, Capital, Profile earnings |
| Funding intent | Capital | Capital, Communities readiness, Mission return path | Capital funding actions | Capital, Communities, Discover |
| Wallet and spendable balance | Capital + confirmed provider/chain | Capital, Mission cost context, Communities readiness | Wallet/funding/claim routes | Capital, Communities, Profile |
| Settlement batch | Capital | Capital, Communities readiness, receipts | Capital settlement action | Capital, Communities, receipts, Profile earnings |
| Chain transaction | Capital reconciler | Capital, receipts, public passport | Reconciler/webhook | Capital, receipts, Communities |
| Receipt | Capital | Capital, public receipt/passport, Communities activity | Confirmation reconciler only | receipts, Capital, Communities |
| Operational event | Append-only event store | Communities Activity, operator diagnostics | Domain services/outbox | Relevant aggregate feeds |

## Tab contract

- Discover owns opportunities, pools, active funding programs, and public discovery.
- Mission owns evidence analysis, Blueprint creation, simulation, decision support, and authorization preparation.
- Communities owns installation, sources, identity resolution, policies, obligations, operating readiness, and the handoff package.
- Capital owns wallets, money movement, funding, settlement execution, reconciliation, claims, and receipts.
- Profile owns user identity, connections, and payout destinations.

## URL and handoff context

Cross-tab links must carry an addressable artifact identifier whenever one exists. Query parameters are navigation context, not the source of truth. Capital must resolve a Blueprint/funding intent/settlement package from storage rather than ask a user to recreate it. Every handoff includes a return path and the originating community/program where applicable.

## Lifecycle vocabulary

All mutations use: `idle → validating → optimistic/submitting → pending_external → confirmed`, with explicit `rejected` and `sync_failed` recovery states. “Request sent” is not success. Receipts are created only after chain confirmation.

