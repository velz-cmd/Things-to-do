# RESOLVE — 90-Second Hackathon Demo Script

## Setup (before judges arrive)

1. Open https://resolve-task.vercel.app
2. Confirm Vercel env: `RESEND_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS`, `DEPUTY_ORACLE_PRIVATE_KEY`
3. Fund MetaMask on **Arc Testnet** (chain `5042002`) via https://faucet.circle.com

## Script (90 seconds)

| Time | Action | Say |
|------|--------|-----|
| 0:00 | **Overview** tab | "RESOLVE is not an AI assistant. You assign a real-world outcome and pay only when proof is verified." |
| 0:10 | Tap **$43 airline refund** example | "User assigns: recover my delayed flight compensation." |
| 0:15 | Open task → **Connect wallet** → **Lock USDC on Arc** | "Funds lock in escrow on Arc testnet. We only get paid on proof." |
| 0:25 | **Deploy mission** | "Watch the package timeline — like tracking a parcel, not a chat log." |
| 0:40 | Point at timeline — Resend email sent | "Real outbound claim email via Resend. Real audit trail in Evidence." |
| 0:50 | Open **/merchant** → Approve refund | "Merchant confirms refund — proof engine verifies, not the LLM." |
| 1:00 | Show **Proof VERIFIED** + Arcscan link | "Arc escrow releases. Net gain: recovered minus execution cost." |
| 1:10 | **Overview** — money recovered, success feed | "Pay-per-resolution, not pay-per-token." |
| 1:15 | Optional: **Vault** tab | "Smart budgets and guardian — crypto infrastructure, hidden from the main pitch." |

## Navigation (3 tabs)

- **Overview** — assign outcomes, financial snapshot, active missions
- **Tasks** — package-tracking timeline, agents inside the task, evidence
- **Vault** — escrow budgets, guardian, recovery (coming soon)

## Arc links to show

- Escrow contract: `0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f`
- Explorer: https://testnet.arcscan.app

## Test email API

```bash
curl -X POST https://resolve-task.vercel.app/api/email/test
```

## Lepton submission checklist

- [ ] Live URL (Overview, Tasks, Vault)
- [ ] GitHub repo
- [ ] Demo video (this script)
- [ ] Arc testnet tx screenshots
- [ ] Canteen Discord traction post

**Winning line:** *"RESOLVE is not pay-per-token. It is pay-per-resolution."*
