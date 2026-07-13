# Arc and Circle Integration

## Verified Arc Testnet configuration

| Parameter | Value |
|---|---|
| Chain ID | `5042002` |
| CAIP-2 | `eip155:5042002` |
| Native gas token | USDC, 18-decimal gas accounting |
| ERC-20 USDC interface | `0x3600000000000000000000000000000000000000`, 6 decimals |
| Primary RPC | `https://rpc.testnet.arc.network` |
| Official fallbacks | Blockdaemon, dRPC, QuickNode Arc endpoints |
| WebSocket | `wss://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

Sources: [Arc connect/network reference](https://docs.arc.io/arc/references/connect-to-arc), [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses), and [Arc gas/fees](https://docs.arc.io/arc/references/gas-and-fees).

The code keeps native gas units and ERC-20 token units separate in `src/lib/money/usdc.ts`. Contract budgets, approvals, and transfers use six-decimal token units. Transaction fee fields use eighteen-decimal native gas units. Values are parsed from decimal strings into `bigint`; floating-point arithmetic is not used inside the new money boundary.

## RPC route

Server reads use this order:

1. `ALCHEMY_ARC_RPC_URL` or an Alchemy URL constructed from `ALCHEMY_API_KEY` when configured.
2. `ARC_RPC_URL` / `ARC_TESTNET_RPC_URL`.
3. Comma-separated `ARC_RPC_FALLBACK_URLS`.
4. Official Arc primary and provider endpoints.
5. Cached last-known state where the caller supplies a cache key.
6. A visibly degraded/pending state; never fabricated live data.

Each provider result can carry provider name, source (`provider`, `cache`, `fallback`), staleness, and failure provenance.

## Wallet architecture

- Human/user wallets remain user-authorized and are represented in Profile/Capital.
- Circle developer-controlled wallets are server-side operational wallets for treasury, agent, and automated settlement work.
- `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` never enter browser bundles or responses.
- New production records distinguish wallet owner type, custody type, provider wallet ID, network, address, status, and optional spending policy.
- Existing `AppConfig` entity-secret fallback is legacy. Production migration should use environment or encrypted secret management and then remove database plaintext fallback.

Circle’s official developer-wallet quickstart requires an API key, registered entity secret, wallet set, and explicit wallet creation on `ARC-TESTNET`: [Circle developer-controlled wallets](https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet).

## Gateway and x402

x402 is reserved for paid, verifiable external context—for example security intelligence or premium evidence—not for ordinary navigation or internal database reads.

Required flow:

1. Resource returns HTTP 402 and `PAYMENT-REQUIRED`.
2. Buyer signs an offchain EIP-3009 authorization and retries with `PAYMENT-SIGNATURE`.
3. The server settles through Gateway and returns verified resource data plus `PAYMENT-RESPONSE`.
4. Gateway authorization/webhook events are deduplicated and persisted.
5. The purchased context stores provider, price, payment reference, timestamp, and evidence lineage.

Circle documents v2 payload creation and Gateway batching for gasless sub-cent settlement: [x402 concepts](https://developers.circle.com/gateway/nanopayments/concepts/x402), [seller quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/seller), and [batching SDK reference](https://developers.circle.com/gateway/nanopayments/references/sdk).

## Settlement and confirmation

- Communities prepares a complete settlement package; Capital executes it.
- The stored canonical package contains community, program, immutable program/policy versions, obligation IDs, verified payee addresses, exact micro-USDC amounts, total, evidence-root hash, simulation ID, and prepared timestamp.
- The package and its SHA-256 hash are verified again immediately before execution.
- A submission creates a durable idempotency record and pending chain transaction.
- Circle/API submission is not success.
- Reconciliation reads Circle state, Arc receipt status, expected transfer events, amount, token interface, recipient, and chain ID.
- A public receipt is generated only after confirmed success.
- Multicall3From is enabled only after payee addresses, totals, simulation, balance, gas, and compliance checks pass.
- Memo metadata is used only for wallet/account types supported by the official flow; unsupported smart-account paths must omit it.
- Partial batches preserve confirmed payees. Retry keys are scoped per settlement batch and obligation so a failed payee can be retried without repaying successful recipients.

## Feature flags

- `ARC_BATCH_SETTLEMENT_ENABLED`
- `ARC_MEMO_ENABLED`
- `ARC_ERC8004_ENABLED`
- `ARC_ERC8183_ENABLED`
- `CIRCLE_GATEWAY_X402_ENABLED`

Flags default off for advanced money-moving capabilities unless configuration, contracts, and tests are present. Arc is currently testnet-only; no interface may imply mainnet settlement.
