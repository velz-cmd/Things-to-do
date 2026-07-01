# Production operations — real money checklist

**Live app:** https://resolve-task.vercel.app  
**Status API:** `GET /api/status/production`  
**Config API:** `GET /api/config` (no secrets returned)

> Never paste API keys into chat, tickets, or git. Set values only in the Vercel dashboard (Production environment).

---

## What is already live (verified via production APIs)

| Capability | Status |
|------------|--------|
| `DEPUTY_DEMO_MODE` | Off in production |
| Arc on-chain payouts | `liveArc: true`, treasury ~200 USDC |
| Circle wallets | Client wallet configured |
| Agent x402 gateway | `gatewayEnabled: true` on `/api/agent/services` |
| Authorization ledger | 50+ rows, DB healthy |
| GitHub, OpenAlex, OpenRouter, Groq, Gemini, Tavily, Libraries.io | Connected |
| Resend | Enabled |

---

## What you need to fix in Vercel (no values here — names only)

### Critical for creator / operator flows

| Env var | Why |
|---------|-----|
| `GOOGLE_REFRESH_TOKEN` | Gmail shows `invalid_grant` — re-run OAuth at `/api/connectors/gmail/authorize` and store new refresh token |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Must match the OAuth app used for Gmail connect |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | Profile → Connect GitHub (separate from `GITHUB_TOKEN`) |
| `CLAIM_TOKEN_SECRET` | Signed `/claim?token=` links |
| `CRON_SECRET` | Notify-claimable cron |

### Already set if Arc payouts work (confirm, do not rotate casually)

| Env var | Role |
|---------|------|
| `CIRCLE_API_KEY` | Developer-controlled wallets |
| `CIRCLE_ENTITY_SECRET` | 64-char hex entity secret (not the client key label) |
| `CIRCLE_WALLET_SET_ID` | Wallet set for per-user app wallets |
| `ARC_CLIENT_WALLET_ADDRESS` | Treasury / x402 seller |
| `ARC_PROVIDER_WALLET_ADDRESS` | Provider rail |
| `ARC_AGENT_GATEWAY_PRIVATE_KEY` | x402 payer (or `DEPUTY_ORACLE_PRIVATE_KEY`) |
| `ALCHEMY_API_KEY` | Treasury balance reads before payout |

### Optional / fix broken integrations

| Env var | Production issue seen |
|---------|----------------------|
| `SERPER_API_KEY` | HTTP 400 — fix key or rely on Tavily fallback |
| `NAVIDROME_*` + bridge on host | Music sensor (not on Vercel) |
| `LISTENBRAINZ_TOKEN` | Earn identity for music |

### Must stay false in production

| Env var | Value |
|---------|-------|
| `DEPUTY_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_DEPUTY_DEMO_MODE` | `false` |

---

## Real user actions (not cosmetic)

| Action | Where | Requires |
|--------|-------|----------|
| Connect GitHub / ListenBrainz / Jellyfin | Discover → Earn | Sign-in |
| Claim USDC | `/claim` | Sign-in + profile wallet + claimable authorizations |
| Fund program | Discover board → Capital | Sign-in + treasury |
| Install community + deploy | `/communities` | Sign-in |
| Pay for agent signal (x402) | Discover → Agent Signal Market | Sign-in + gateway (live on prod) |
| View fee receipt | `/receipt/{id}` | Public |
| Automation notify rule | Bubble console → Automate | Sign-in + installed community |

**Wallet model:** Each user gets a RESOLVE app wallet (Circle on Arc testnet when configured). External wallets stay in `scanWalletAddress`; claims pay `profile.walletAddress`.

---

## Verify after deploy

```bash
curl -s https://resolve-task.vercel.app/api/status/production | jq '.real,.issues'
curl -s https://resolve-task.vercel.app/api/config | jq '.liveArc,.arcTreasury,.agentStack.enabled,.demoMode'
curl -s https://resolve-task.vercel.app/api/agent/services | jq '.gatewayEnabled,.tagline'
```

---

## Still planned (not fake — explicitly unshipped)

- Operator SaaS, B2B reports (`platform-revenue.ts` → `shipped: false`)
- Repayment waterfall on Discover (simulate API only)
- ERC-8183 mission escrow vault (today: ledger `escrow:…` refs + real `deployProgramOnArc` batches)
- Plaid recurring discovery (Mission tool returns error in production)
- Hackathon merchants (Mission demo only when `DEPUTY_DEMO_MODE=true`)
