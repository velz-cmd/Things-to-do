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

The **Entity Secret** is a **32-byte (64 hex character) key** you generate and register. Circle Console shows **Registered Time** when active but **never shows the raw hex again**.

Location: **Circle Console → Configurator → Wallet Security Settings → Entity Secret**

```
CIRCLE_ENTITY_SECRET=abcdef0123456789...   # 64 hex chars, lowercase ok, no colons
```

Some recovery exports include a colon — RESOLVE strips colons automatically.

## Lost entity secret (Console shows a date, you do not have the hex)

**Cancel the "Rotate Entity Secret" dialog.** Rotation requires **current** and **new** ciphertext fields. If you do not have the current 64-char hex (or recovery file), you cannot complete that form.

### Step 1 — Look for a copy you already saved

| Where | What to check |
|-------|----------------|
| **Vercel** | Project → Settings → Environment Variables → `CIRCLE_ENTITY_SECRET` |
| **Production DB** | `appConfig` row `circle_entity_secret` (RESOLVE caches after auto-register) |
| **Local `.env`** | From an earlier `register` script run |
| **Recovery file** | `recovery_file_*.dat` from registration (June 2026, etc.) |

If you find the hex in Vercel or DB, paste it into Vercel if missing and redeploy. Verify:

```bash
CIRCLE_API_KEY='TEST_API_KEY:…' CIRCLE_ENTITY_SECRET='…' npx tsx scripts/register-circle-entity-secret.ts verify
```

### Step 2 — Reset with recovery file (preferred if hex is gone)

Circle Console → **Entity Secret** → **Reset** (not Rotate) → upload `recovery_file_*.dat`.

- Circle issues a **new** entity secret and recovery file.
- Copy the new hex into Vercel as `CIRCLE_ENTITY_SECRET` immediately.
- Old wallets tied to the previous secret **stop working** for new transactions until you use the new secret everywhere.

### Step 3 — Fresh API key (no hex, no recovery file)

If both the entity secret and recovery file are lost, Circle cannot recover existing developer-controlled wallets for that entity. Per [Circle docs](https://developers.circle.com/wallets/dev-controlled/entity-secret-management):

1. Circle Console → create a **new API key**.
2. On your machine (with the new key only):

   ```bash
   export CIRCLE_API_KEY='TEST_API_KEY:new-uuid:new-secret'
   npx tsx scripts/register-circle-entity-secret.ts register
   ```

3. Save the printed `CIRCLE_ENTITY_SECRET` and `recovery/recovery_file_*.dat`.
4. Update Vercel: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, clear or recreate `CIRCLE_WALLET_SET_ID`, re-run treasury bootstrap (`scripts/setup-circle-treasury.ts` or `POST /api/admin/circle/setup-wallet-set`).
5. Users may need new RESOLVE wallets (old Circle wallet IDs were bound to the old entity).

### What NOT to do

- Do not paste `TEST_CLIENT_KEY` into `CIRCLE_ENTITY_SECRET`.
- Do not commit secrets to git.
- Do not use Console **Rotate** without the current secret — use **Reset** + recovery file instead.

## Register or verify (operators)

```bash
# First-time registration (new API key / never registered)
CIRCLE_API_KEY='TEST_API_KEY:…' npx tsx scripts/register-circle-entity-secret.ts register

# Optional: append to local .env
CIRCLE_API_KEY='…' npx tsx scripts/register-circle-entity-secret.ts register --write-env

# Test an existing secret (env and/or DB cache)
CIRCLE_API_KEY='…' CIRCLE_ENTITY_SECRET='…' npx tsx scripts/register-circle-entity-secret.ts verify
```

Production one-shot (requires `CRON_SECRET` if set):

```bash
curl -sS -X POST 'https://YOUR_APP/api/admin/circle/register-entity-secret' \
  -H "Authorization: Bearer $CRON_SECRET"
```

Returns a new secret only when RESOLVE generates one; otherwise confirms the cached/env secret works.

## Minimum Vercel env (Arc testnet)

See also `docs/VERCEL_ENV.md`.

| Variable | Example / notes |
|----------|-----------------|
| `CIRCLE_API_KEY` | Full `TEST_API_KEY:…:…` string |
| `CIRCLE_ENTITY_SECRET` | 64-char hex (from register script or Reset flow) |
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
- Rotate API keys if they were pasted in chat or tickets.
- Store `recovery_file_*.dat` outside the repo (add `recovery/` is gitignored).
- `TEST_CLIENT_KEY` is safe to embed in frontends for Modular Wallets only — it is **not** a substitute for `CIRCLE_ENTITY_SECRET` on the server.
