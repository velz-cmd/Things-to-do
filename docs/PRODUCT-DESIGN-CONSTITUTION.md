# RESOLVE Product Design Constitution

> **Superseded by [PRODUCT-DIRECTION.md](./PRODUCT-DIRECTION.md) (frozen).** UX rules below remain valid where not in conflict.

## Interim surfaces (being replaced)

| Surface | Question it answers |
|---------|-------------------|
| **Workspace** | Where is value being created? |
| **Payments** | What has been authorized, funded, or settled? |
| **Connectors** | Where is value coming from? |
| **Profile** | Who am I? |

## Target surfaces (Blueprint v1)

| Surface | Question it answers |
|---------|---------------------|
| **Home** | Where should RESOLVE attach? |
| **Activity** | What's happening? |
| **Earnings** | What am I owed / received? |
| **Connections** | What ecosystems are linked? |
| **Account** | Who am I? |

Never create separate pages for Treasury, Settlement, Signals, Weight, Radar, Analytics, AI, Registry, or Graph. Those are backend systems hidden behind workflows.

## Rules

1. **Build a product, not a demo** — every screen solves a complete user problem.
2. **One workflow, one place** — never split a workflow across multiple pages.
3. **Backend complexity, frontend simplicity** — users see Analyze, Review, Approve, Track, Claim, Done.
4. **Every API must justify its existence** — real endpoints, real names, real timestamps. No cosmetic cards.
5. **Fake data is prohibited** — metrics must trace to an actual source.
6. **Adapt to the user's ecosystem** — GitHub maintainers, musicians, photographers each see familiar language.
7. **Live by default** — connector health, analysis, authorizations, settlements update in real time.
8. **Progressive disclosure** — default view is simple; evidence and technical depth on request ("Why?").
9. **Premium quality** — ship like Cursor, Stripe, Linear, Vercel — clarity, speed, trust, polish.
10. **Platform quality** — every feature is backed by a real service, works end-to-end, exposes honest status.

RESOLVE is an operating system for creator settlements — not a dashboard of cards.
