# RESOLVE — Hackathon Win Playbook

**Live app:** https://resolve-task.vercel.app  
**Repo:** https://github.com/velz-cmd/Things-to-do  
**Winning line:** *"RESOLVE is not pay-per-token. It is pay-per-resolution."*

---

## Phase 1 — One-time setup (30 minutes)

### 1. Vercel environment variables

Confirm **all** of these are set on Vercel → things-to-do → Settings → Environment Variables → **Production**:

| Variable | What it does |
|----------|----------------|
| `DATABASE_URL` | Supabase Postgres (pooler URL, port 6543 or 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown / WalletConnect project ID |
| `NEXT_PUBLIC_APP_URL` | `https://resolve-task.vercel.app` |
| `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS` | `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f` |
| `DEPUTY_ORACLE_PRIVATE_KEY` | Oracle wallet (settles escrow on Arc) |
| `RESEND_API_KEY` | Real outbound claim emails |
| `RESEND_FROM_EMAIL` | Verified sender in Resend |
| `RESEND_CLAIM_TO` | Your email (receives demo claims) |
| `GEMINI_API_KEY` | AI planner (optional — fallback plan works) |
| `DEPUTY_DEMO_MODE` | `false` for judge demo (real merchant step) |
| `NEXT_PUBLIC_DEPUTY_DEMO_MODE` | `false` |
| `CRON_SECRET` | Random string for cron worker |

After adding/changing vars → **Redeploy** (or push to `main`).

### Vercel deploy rate limit (bypass)

If GitHub shows **Deployment rate limited — retry in 24 hours**, production may stay on an old commit. Bypass without waiting:

```bash
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

Confirm: `curl https://resolve-task.vercel.app/api/health/deploy` → `commit` matches latest `main`.

**Backup host:** connect [Render Blueprint](https://render.com/docs/blueprint-spec) from this repo (`render.yaml`) and copy the same env vars from Vercel. `npm run start` binds to `PORT` for Render.

### 2. Supabase Auth (Google + email)

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication**
2. **Providers** → enable **Google** (add OAuth client from Google Cloud Console)
3. **URL Configuration** → add redirect:
   - `https://resolve-task.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local)
4. **Site URL:** `https://resolve-task.vercel.app`
5. Enable **Email** provider (magic link)

### 3. Reown (WalletConnect)

1. [dashboard.reown.com](https://dashboard.reown.com) → your project
2. Add allowed domain: `resolve-task.vercel.app`
3. Copy **Project ID** → `NEXT_PUBLIC_REOWN_PROJECT_ID` on Vercel

### 4. Arc testnet funds (crypto demo path)

1. [faucet.circle.com](https://faucet.circle.com) → **Arc Testnet** USDC
2. MetaMask → add **Arc Testnet** (chain `5042002`, RPC `https://rpc.testnet.arc.network`, symbol **USDC**)

---

## Phase 2 — Verify APIs work (5 minutes)

Run these in terminal (or browser for GET):

```bash
# Config — should show escrowDeployed: true, resendEnabled: true
curl https://resolve-task.vercel.app/api/config

# Tasks — should return 200 with tasks array (not 500)
curl https://resolve-task.vercel.app/api/tasks

# Stats
curl https://resolve-task.vercel.app/api/stats

# Email smoke test
curl -X POST https://resolve-task.vercel.app/api/email/test
```

If `/api/tasks` returns **500**, redeploy from Vercel (build now runs `prisma db push` to sync tables).

---

## Phase 3 — Run the judge demo (90 seconds)

**Opening line:** *"We built the outcome network on Arc — work gets funded only when outcomes are verified."*

### Path B — LEAD: Bounty / contributor payout (recommended opener)

| Step | You do | You say |
|------|--------|---------|
| 1 | Open `/start` → sign in | "Assign a financial mission — not a chatbot." |
| 2 | Pick **Pay designer when logo approved** | "Funds lock in Arc escrow." |
| 3 | Lock budget → Deploy mission | "Agents execute; treasury holds USDC." |
| 4 | `POST /api/webhooks/github` or Treasury **Trigger PR merge** | "GitHub PR merged — proof arrives." |
| 5 | Task → Proof verified → Settled | "Payment releases only after verification." |

```bash
curl -X POST https://resolve-task.vercel.app/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"pull_request":{"merged":true,"number":1,"title":"Logo approved"},"repository":{"full_name":"demo/logo-bounty"}}'
```

### Path C — Founder distribution (Canteen / Distribution Bootstrap)

| Step | You do | You say |
|------|--------|---------|
| 1 | Open `/distribute` | "Founders can't distribute to creators — we solve that." |
| 2 | Click **Seed demo registry** on `/treasury` if needed | "Attribution: who gets paid." |
| 3 | Click **Distribute when verified** | "RESOLVE resolves wallets, samples verification, batch-settles." |
| 4 | Show Arcscan link + compliance CSV | "Stripe collects. Sidecars count. RESOLVE proves and pays." |

### Path A — Consumer refund (supporting demo)

| Step | You do | You say |
|------|--------|---------|
| 1 | `/start` → airline refund mission | "Same proof rail for consumer outcomes." |
| 2 | Deploy → `/merchant` approve | "Merchant confirms — proof engine verifies." |
| 3 | Settled + net gain | "Pay-per-resolution, not pay-per-token." |

**Closing line:** *"We're not building another agent. We built the economic system agents and founders get paid through."*

---

## Phase 3 (legacy) — Full walkthrough tables

### Path A — Non-crypto user

| Step | You do | You say |
|------|--------|---------|
| 1 | Open https://resolve-task.vercel.app | "This is RESOLVE — assign a problem, come back when it's solved." |
| 2 | Sidebar → **Sign in** → Google | "No crypto knowledge required. We create a secure wallet behind the scenes." |
| 3 | **Add funds** → $50 → Credit card | "Deposits convert to USDC automatically." |
| 4 | Overview → **Recover airline refund** | "User assigns: get my $43 flight delay refund." |
| 5 | Task page → **Lock from balance** | "Budget locks — we only get paid on verified proof." |
| 6 | **Deploy mission** | "Watch the package timeline — not a chatbot." |
| 7 | Point at timeline + Evidence (email sent) | "Real Resend email. Real audit trail." |
| 8 | Open `/merchant` → **Approve refund** | "Merchant confirms — proof engine verifies, not the LLM." |
| 9 | Back to task → Proof verified + net gain | "Pay-per-resolution, not pay-per-token." |
| 10 | Overview success feed + Vault balances | "Money recovered. Infrastructure hidden." |

### Path B — Crypto user (Arc + Circle story)

Same as Path A but step 2–5:

- **Connect crypto wallet** (Reown → MetaMask)
- If yellow banner → **Switch to Arc Testnet**
- **Lock $1 USDC on Arc** (MetaMask may say "ETH" — on Arc it's USDC)
- Show Arcscan tx: https://testnet.arcscan.app

---

## Phase 4 — Submission package (Lepton / Canteen)

- [ ] **Live URL:** https://resolve-task.vercel.app
- [ ] **GitHub:** public repo link
- [ ] **90-sec demo video** — record Path A with Loom/OBS (follow table above)
- [ ] **Arc tx screenshot** — escrow lock + settlement on Arcscan
- [ ] **One paragraph pitch:**

  > RESOLVE is the outcome network on Arc. Assign financial missions — bounties, contributor payouts, founder distribution to open-source creators. USDC locks in escrow and releases only when the proof engine verifies the outcome. Same rail for consumer refunds and creator micropayments. Work gets funded only when outcomes are verified.

- [ ] **Canteen Discord** — post demo link + screenshot + "pay only on proof" hook
- [ ] **Circle/Arc angle** — mention Arc testnet USDC escrow + consumer on-ramp path

---

## Phase 5 — Optional polish (if time)

| Item | How |
|------|-----|
| Gmail real evidence | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` on Vercel |
| Gemini live planning | Fresh `GEMINI_API_KEY` with quota |
| Circle embedded wallets | `CIRCLE_API_KEY` + `CIRCLE_APP_ID` for production on-ramp |
| Custom domain | Vercel → Domains → `resolve.app` etc. |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Google sign-in loops | Check Supabase redirect URL + Site URL |
| Wallet shows ETH not USDC | Switch to Arc Testnet (chain 5042002) |
| `/api/tasks` 500 | Redeploy — DB schema syncs on build |
| No email in timeline | Check `RESEND_API_KEY` + `RESEND_CLAIM_TO` |
| Auto merchant approve | Set `DEPUTY_DEMO_MODE=false` |
| WalletConnect empty | Check `NEXT_PUBLIC_REOWN_PROJECT_ID` + domain allowlist |

---

## What judges should feel

1. **Assign** — one tap, not a chat
2. **Track** — package timeline, confidence, agents inside task
3. **Proof** — merchant portal + evidence panel
4. **Pay** — escrow / balance lock → release on proof
5. **Trust** — looks like Notion/Linear, not a crypto dashboard

**You are ready when Path A completes end-to-end without errors.**
