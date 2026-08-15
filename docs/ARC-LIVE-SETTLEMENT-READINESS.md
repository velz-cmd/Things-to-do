# Arc live settlement readiness

Status of the `ARC_ERC8183_ENABLED` safety gate, what has been verified,
and the exact remaining step. Format: BLOCKER → ROOT CAUSE → SAFE FIX →
EXECUTION PROOF.

## The gate

`isLiveArcEnabled()` in `src/lib/settlement/arc-config.ts` is the single
live-money gate consumed across Discover. It requires **all** of:

1. `ARC_ERC8183_ENABLED === "true"` (`src/lib/arc/feature-flags.ts`)
2. `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` present
3. `ARC_CLIENT_WALLET_ADDRESS` set
4. `ARC_PROVIDER_WALLET_ADDRESS` set

`getArcReadiness()` (`src/lib/treasury/arc-readiness.ts`) additionally
verifies the treasury holds enough USDC, read on-chain via Alchemy.

## Verifying without handling secrets

`GET /api/treasury/arc-readiness` returns only booleans, blocker strings,
the public treasury address, and a balance — no secrets. This makes
readiness verifiable from outside the credentialed environment, which is
how the checks below were run.

## What was verified (2026-08-15)

**Production** (`https://resolve-self.vercel.app/api/treasury/arc-readiness`):

```json
{"liveArc":false,
 "blockers":["ERC-8183 settlement is disabled until testnet checks pass"],
 "clientWallet":"0xd8c4bb234e42b87109c42a928e908d73c0e6bc3c",
 "balanceUsd":105,
 "canDistributeOnChain":false}
```

Exactly one blocker. Every other prerequisite already passes in
production — Circle credentials, both wallet addresses, and a treasury
funded with **105 USDC on Arc testnet** (a real on-chain read).

**On-chain checks** against `https://rpc.testnet.arc.network`:

| Check | Method | Result |
|---|---|---|
| Chain reachable, correct id | `eth_chainId` | `0x4cef52` = 5042002 ✅ |
| ERC-8183 escrow deployed | `eth_getCode` on `0x0747EEf0706327138c69792bF28Cd525089e4583` | bytecode present (EIP-1967 proxy) ✅ |
| USDC deployed | `eth_getCode` on `0x3600…0000` | bytecode present (upgradeable proxy) ✅ |

**Preview with the flag enabled** — `ARC_ERC8183_ENABLED=true` was added
to the **Preview environment only**; production was left untouched:

```json
{"liveArc":true,"blockers":[],"balanceUsd":105,"canDistributeOnChain":true,
 "message":"On-chain Arc memo payouts ready"}
```

The gate opens cleanly with zero blockers, and `/discover` renders 200
with all five surfaces and no errors while live actions are enabled.

## Why production is still disabled

The flag means "testnet checks pass". Everything checkable *without
moving money* now passes. The one check that would be conclusive — a real
`createJob → fund → submit → complete` cycle — has **not** been executed,
because:

- The ERC-8183 ABI (`src/lib/settlement/erc8183-abi.ts`) exposes no view
  functions, so contract conformance cannot be proven by a free read.
- Every settlement route is behind `requireReadyUser()`, so executing one
  needs an authenticated browser session.
- Signing happens with the Circle entity secret, which exists only inside
  the deployed environment.

Proving the gate should open therefore requires the capability the gate
controls. Enabling Preview only is the safe way to break that cycle: it
creates a real environment to run the proof in without exposing canonical
production.

**Do not enable production until a real transaction has been observed
end to end.** This is not a formality — it is the only check that
distinguishes "configured" from "works".

## Remaining step

From an authenticated session against the Preview deployment that has the
flag enabled, run the smallest real economic action (a work reward or a
request release) and confirm the full chain:

authorization → submitted Arc Testnet USDC tx → confirmed →
persisted settlement → receipt → Activity

Record the tx hash, settlement id, and receipt reference. If that
succeeds, `ARC_ERC8183_ENABLED=true` is justified for Production and can
be added with `vercel env add ARC_ERC8183_ENABLED production` followed by
a redeploy. If it fails, the gate correctly stayed shut and the failure
is the next thing to fix.

## Rollback

`vercel env rm ARC_ERC8183_ENABLED preview` and redeploy returns Preview
to the blocked state.
