# RESOLVE — Build checklist (Day 1–6)

## Product vision

**One line:** Assign the problem. Come back when it's solved. Pay only on proof.

**Live:** https://resolve-task.vercel.app

---

## Status

| Day | Area | Status |
|-----|------|--------|
| 1 | Arc, Supabase, RESOLVE shell | Done |
| 2 | Agents, executor, cron | Done |
| 3 | Resend, Gmail*, Playwright* | Done (*env optional) |
| 4 | Overview / Tasks / Vault UI | Done |
| 5 | Arc escrow + Foundry tests | Done |
| 6 | Demo script, deploy, consumer wallet | Done |

## Shipped features

- [x] RESOLVE 3-tab UI (Overview, Tasks, Vault)
- [x] Reown AppKit — MetaMask, Rabby, Coinbase, WalletConnect
- [x] Supabase Google + email sign-in
- [x] Embedded wallet + balance lock (no crypto required)
- [x] Add funds (card, debit, PayPal, bank → USDC balance)
- [x] All 6 outcome templates wired
- [x] Arc Testnet USDC escrow (on-chain path)
- [x] Merchant proof portal
- [x] Resend outbound emails
- [x] Proof engine + package timeline
- [x] Production deploy + DB sync on build

## Hackathon deliverables

- [x] Live URL
- [x] GitHub repo
- [ ] 90-second demo video — [DEMO.md](../DEMO.md)
- [ ] Arc tx screenshots
- [ ] Canteen Discord post

## Optional polish

- [ ] Gmail OAuth (`GOOGLE_*` env vars)
- [ ] Circle production on-ramp (`CIRCLE_*`)
- [ ] Gemini live planner (quota)

**Winning line:** *"RESOLVE is not pay-per-token. It is pay-per-resolution."*
