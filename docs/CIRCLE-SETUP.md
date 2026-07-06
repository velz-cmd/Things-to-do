# Circle + Arc setup for RESOLVE operators

End users never touch Circle Console. Operators set server env once on Vercel; Gmail/GitHub sign-in provisions a **developer-controlled** Circle wallet per user.

## Keys in Circle Console — what is what

| Circle Console item | Env var | Used for |
|---------------------|---------|----------|
| **API Key** (`TEST_API_KEY:uuid:secret`) | `CIRCLE_API_KEY` | Server-side Circle Developer Wallets API |
| **Client Key** (`TEST_CLIENT_KEY:…`) | *(not used by RESOLVE server)* | Modular Wallets SDK on the **client** only |
| **App ID** (Configurator) | *(optional)* | User-controlled wallets / App Kit — not required for dev-controlled wallets |
| **Entity Secret** (Configurator → Entity Secret) | `CIRCLE_ENTITY_SECRET` | **Required** for create wallet + Arc transfers |

### Entity Secret is NOT the Client Key

The **Entity Secret** is a **32-byte (64 hex character) key** shown under:

**Circle Console → Configurator → Wallet Security Settings → Entity Secret**

- You generate it once (or rotate) and **register** the ciphertext with Circle.
- Circle shows **Registered Time** when it is active.
- It is **not** printed in the API Key or Client Key strings.
- Recovery files are only available when you **rotate** the secret.

If `CIRCLE_ENTITY_SECRET` is wrong, users see Arc transfer failures after Gmail sign-in (wallet provision or fund). RESOLVE also caches a working secret in the database when auto-registration succeeds.

### Format

```
CIRCLE_ENTITY_SECRET=abcdef0123456789...   # 64 hex chars, lowercase ok, no colons
```

Some recovery exports include a colon — RESOLVE strips colons automatically.

## Minimum Vercel env (Arc testnet)

See also `docs/VERCEL_ENV.md`.

| Variable | Example / notes |
|----------|-----------------|
| `CIRCLE_API_KEY` | Full `TEST_API_KEY:…:…` string |
| `CIRCLE_ENTITY_SECRET` | 64-char hex from Configurator |
| `CIRCLE_WALLET_SET_ID` | Wallet set where user wallets are created |
| `ARC_CLIENT_WALLET_ADDRESS` | Settlement treasury (pool funds land here) |
| `ARC_PROVIDER_WALLET_ADDRESS` | Agent / platform fee wallet |

Fund the treasury from [Circle Faucet](https://faucet.circle.com) → Arc Testnet.

## Verify after deploy

```text
GET /api/health/env          → CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET true
GET /api/settlement/config   → arc live flags
```

Sign in → Capital or Discover fund → pick **RESOLVE wallet** or **Connected wallet**.

## User payment paths (no Vercel)

| User choice | What happens |
|-------------|----------------|
| **RESOLVE wallet (sign-in)** | Server uses Circle dev-controlled wallet + entity secret |
| **Connected wallet (you sign)** | User signs USDC transfer on Arc; server verifies `txHash` |

## Security

- Never commit API keys, entity secrets, or client keys to git.
- Rotate keys if they were pasted in chat or tickets.
- `TEST_CLIENT_KEY` is safe to embed in frontends for Modular Wallets only — it is **not** a substitute for `CIRCLE_ENTITY_SECRET` on the server.
