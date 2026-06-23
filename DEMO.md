# RESOLVE — 90-Second Hackathon Demo Script

**Live:** https://resolve-task.vercel.app

## Setup (before judges)

1. Open https://resolve-task.vercel.app
2. Confirm `/api/config` shows `escrowDeployed: true`, `resendEnabled: true`
3. For crypto path: fund Arc Testnet USDC at https://faucet.circle.com

---

## Path A — Non-crypto (recommended, ~90 sec)

| Time | Action | Say |
|------|--------|-----|
| 0:00 | **Overview** | "RESOLVE is not an AI assistant. Assign a real outcome — pay only when proof is verified." |
| 0:08 | **Sign in** → Google | "No crypto knowledge required. We create a secure wallet behind the scenes." |
| 0:15 | **Add funds** → Card & PayPal → $50 | "No bridging. RESOLVE handles Arc USDC in the background." |
| 0:22 | Tap **Recover airline refund** | "User assigns: $43 delayed flight compensation." |
| 0:28 | **Lock from balance** | "Budget locks in agent escrow. We only get paid on proof." |
| 0:35 | **Deploy mission** | "Package timeline — like tracking a parcel, not a chat log." |
| 0:45 | Timeline + **Evidence** (email) | "Real outbound claim via Resend. Real audit trail." |
| 0:55 | **/merchant** → Approve refund | "Merchant confirms — proof engine verifies, not the LLM." |
| 1:05 | Proof verified + net gain | "Arc settlement on proof. Pay-per-resolution." |
| 1:12 | **Vault** — balances + activity | "Infrastructure hidden. Feels like Stripe, not a crypto app." |

---

## Path B — Crypto user (Arc story)

| Step | Action |
|------|--------|
| Sign in | Google or email (required) |
| Connect wallet | Account menu → Connect crypto wallet (Rabby/MetaMask) |
| Add funds | **Crypto wallet** tab → **Send USDC on Arc** → confirm in wallet |
| Assign + lock | Same as Path A, or **Lock USDC on Arc** for on-chain escrow |
| Proof | Show Arcscan link to agent escrow `0xDD81…b65511` |

---

## Navigation

- **Overview** — assign outcomes, balance, missions
- **Tasks** — package timeline, agents, evidence
- **Vault** — balances, activity, add funds
- **/merchant** — demo merchant refund portal

## Arc contract

`0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f` — https://testnet.arcscan.app

## API smoke test

```bash
curl https://resolve-task.vercel.app/api/config
curl https://resolve-task.vercel.app/api/tasks
curl -X POST https://resolve-task.vercel.app/api/email/test
```

## Submission checklist

- [x] Live URL — https://resolve-task.vercel.app
- [x] GitHub — https://github.com/velz-cmd/Things-to-do
- [ ] Demo video (this script)
- [ ] Arc testnet tx screenshots
- [ ] Canteen Discord traction post

**Winning line:** *"RESOLVE is not pay-per-token. It is pay-per-resolution."*

See also: [docs/HACKATHON_WIN.md](./docs/HACKATHON_WIN.md)
