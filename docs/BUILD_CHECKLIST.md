# RESOLVE — Build checklist (Day 1–6)

> **Note:** The canonical build prompt (`CURSOR_BUILD_PROMPT.md`) lives on your local machine. Paste it into `docs/CURSOR_BUILD_PROMPT.md` in this repo so cloud agents can read it.

## Product vision

**One line:** Assign the problem. Come back when it's solved. Pay only on proof.

**UX:** 3-tab nav — Overview, Tasks, Vault. Package-tracking timeline. Infrastructure hidden from main pitch.

**Demo vertical:** $43 SkyDemo Airlines refund on Arc testnet USDC.

---

## Day 1 — Foundation

| Task | Status |
|------|--------|
| Arc testnet plumbing (wagmi, USDC, escrow contract) | Done |
| Supabase Postgres + Prisma | Done |
| RESOLVE design system + 3-tab shell | Done |
| Vercel deploy config (`vercel.json`) | Done |

## Day 2 — Agent runtime

| Task | Status |
|------|--------|
| Gemini planner + fallback static plan | Done |
| Executor + state machine | Done |
| Cron retry worker (`/api/cron/tick`) | Done |

## Day 3 — Real tools

| Task | Status |
|------|--------|
| Resend outbound claim emails | Done (needs `RESEND_API_KEY` on Vercel) |
| Gmail OAuth evidence search | Code ready — needs `GOOGLE_*` env vars |
| Playwright browser claims | Optional — `PLAYWRIGHT_ENABLED=true` |
| Proof engine (`PROOF_POLICIES`) | Done |

## Day 4 — Consumer UI

| Task | Status |
|------|--------|
| Overview (outcome input, snapshot, missions, feed) | Done |
| Tasks list + package timeline detail | Done |
| Evidence panel (proofs, events, txs) | Done |
| Vault (budget live; guardian/recovery stubs) | Partial |

## Day 5 — Settlement

| Task | Status |
|------|--------|
| `DeputyEscrow.sol` deployed on Arc | Done |
| Oracle release + refund paths | Done |
| Foundry tests (3 passing) | Done |

## Day 6 — Ship

| Task | Status |
|------|--------|
| `DEMO.md` 90-second judge script | Done |
| README + build checklist | Done |
| Production redeploy (Vercel) | **Manual** — confirm GitHub → Vercel hook |
| 90-second demo video | Pending |
| Lepton submission package | Pending |

---

## Remaining to make “real”

- [ ] **Vercel redeploy** — `/tasks` and `/vault` must return 200 on production
- [ ] **Gmail OAuth** — set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- [ ] **Gemini** — valid `GEMINI_API_KEY` (quota was exhausted earlier)
- [ ] **End-to-end Arc demo** — wallet connect → on-chain lock → oracle settlement on Arcscan
- [ ] **Three outcome templates** — forgotten assets, wallet protection, internet bill (currently “soon”)
- [ ] **Vault guardian + recovery** — beyond static stubs
- [ ] **Demo video** — follow `DEMO.md`
- [ ] **Canteen traction post**

## Env vars (production)

See `.env.example`. Critical for live demo:

```
DATABASE_URL
RESEND_API_KEY
NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS=0x4e9b728a3c46315d8ec4df19b972f78b1a4f669f
DEPUTY_ORACLE_PRIVATE_KEY
DEPUTY_DEMO_MODE=true   # set false for real merchant webhook
```

**Winning line:** *"RESOLVE is not pay-per-token. It is pay-per-resolution."*
