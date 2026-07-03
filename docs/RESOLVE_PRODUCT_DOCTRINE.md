# RESOLVE Product Doctrine

Read this before changing product behavior.

RESOLVE is a programmable value settlement layer for open communities, creators, builders, DAOs, operators, and funders.

The product exists because real value is already being created in public and semi-public systems, but money does not reliably flow back to the people who created it. Developers merge code, artists get played, researchers get cited, moderators keep communities alive, creators publish work, and users build on top of others. RESOLVE observes those existing actions, verifies them through proof sources, turns them into payout rules, and settles money through Arc/Circle.

## Mission

Recognize value. Coordinate capital. Settle verified work.

Everything should strengthen this loop:

1. Observe real activity.
2. Recognize who created value.
3. Reason over evidence and policy.
4. Recommend the next economic action.
5. Authorize obligations.
6. Settle payouts.
7. Learn from receipts and outcomes.

## Product Law

Never invent new behavior. Attach to behavior that already happens.

- Already listening -> pay the artist.
- Already watching -> pay the streamer or creator.
- Already citing -> pay the writer or researcher.
- Already depending -> pay the maintainer.
- Already merging -> pay the builder.
- Already moderating -> pay the operator.
- Already remixing -> pay the upstream creators.

Money moves because evidence exists, not because AI guessed.

## Core Surfaces

Discover finds unpaid value and funding opportunities. It answers: what should I care about?

Mission helps humans reason, compare, plan, and simulate. It should not fake execution.

Communities are the operational layer where founders, DAOs, and operators run programs, connect sources, set rules, review obligations, and manage payout queues.

Capital moves money: wallets, claims, funding, Arc/Circle settlement, receipts, audit history, balances, and payout records.

Profile is global identity and connection management: wallet, email, GitHub, MusicBrainz, ListenBrainz, Navidrome, Jellyfin, and future proof sources.

## Discover State Machine

Every opportunity should move through a real economic state:

Detected -> Verified -> Programmed -> Funded -> Settled / Claimable

Cards should expose real actions for the next state, such as:

- connect proof source
- scan evidence
- claim identity
- create payout rule
- create program
- fund pool
- review obligation
- approve payout
- settle
- view proof
- view Arc receipt

## Button Rule

No cosmetic buttons.

Every button must perform or lead directly to a real state-changing action: API call, database write, source connection, proof scan, rule creation, pool funding, claim creation, settlement, or receipt generation.

If a surface only displays information, ask: what action should the user take next? If there is no answer, the feature is incomplete.

## Settlement Backbone

Arc/Circle are not optional add-ons. They are the settlement backbone for USDC flows, escrow, receipts, claims, and proof-based payouts.

Most users should not have to care about Arc, Circle, x402, or USDC. They should care that RESOLVE makes verified work payable.

## Engineering Constraints

- Do not hardcode fake metrics.
- Do not create fake demo data without explicit approval.
- Preserve existing working APIs.
- Every API should connect to evidence, policy, identity, authorization, settlement, or receipt history.
- Empty states should remain useful and action-oriented.
- Prefer small, reviewable changes over product rewrites.

One sentence should guide every PR:

Every line of code should help an existing open community recognize value, coordinate capital, or settle verified work more fairly than they could before.
