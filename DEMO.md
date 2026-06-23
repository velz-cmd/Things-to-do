# DEPUTY — 90-Second Hackathon Demo Script

## Setup (before judges arrive)

1. Open https://resolve-task.vercel.app (or local `npm run dev`)
2. Confirm Vercel env: `RESEND_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS`
3. Fund MetaMask on **Arc Testnet** (chain `5042002`) via https://faucet.circle.com

## Script (90 seconds)

| Time | Action | Say |
|------|--------|-----|
| 0:00 | Landing page | "DEPUTY is not an AI assistant. You assign a real-world outcome and pay only when proof is verified." |
| 0:10 | Click **Open console** | "This is an operations console, not a chatbot." |
| 0:15 | Assign **$43 airline refund** | "User assigns: recover my delayed flight compensation." |
| 0:20 | **Connect wallet** → **Lock USDC on Arc** | "Funds lock in escrow on Arc testnet. Deputy only gets paid on proof." |
| 0:35 | **Deploy deputy agents** | "Watch the agent pipeline: Planner, Evidence, Executor, Retry, Verification." |
| 0:45 | Point at timeline — Resend email sent | "Real outbound claim email via Resend. Real audit trail." |
| 0:55 | Open **/merchant** → Approve refund | "Merchant confirms refund — proof engine verifies, not the LLM." |
| 1:05 | Show **Proof VERIFIED** + Arcscan link | "Arc escrow releases. Net gain: recovered minus deputy cost." |
| 1:15 | Dashboard: money recovered, net gain | "Pay-per-resolution, not pay-per-token." |

## Arc links to show

- Escrow contract: `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f`
- Explorer: https://testnet.arcscan.app

## Test email API

```bash
curl -X POST https://resolve-task.vercel.app/api/email/test
```

## Lepton submission checklist

- [ ] Live URL
- [ ] GitHub repo
- [ ] Demo video (this script)
- [ ] Arc testnet tx screenshots
- [ ] Canteen Discord traction post
