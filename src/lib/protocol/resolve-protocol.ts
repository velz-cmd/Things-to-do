/**
 * RESOLVE Protocol — original primitives (open source, not a clone of claim markets or rug scanners).
 *
 * UVI  — Unpaid Value Index: discover overlooked contributors across any open graph
 * PoW  — Proof-of-Weight: verifiable impact scores before funds move
 * OCG  — Open Contribution Graph: code, media, streams, posts — one valuation layer
 * PSS  — Proportional Settlement Split: N payees, not binary winner-take-all
 * WDL  — Weight Dispute Layer: permissionless challenge on contested shares
 */

export const RESOLVE_PROTOCOL = {
  name: "RESOLVE Open Impact Settlement Protocol",
  version: "0.1.0",
  license: "MIT",
  primitives: [
    {
      id: "uvi",
      name: "Unpaid Value Index",
      verb: "Discover",
      description:
        "Continuously index contributors with measurable impact and zero detected payouts — any platform.",
    },
    {
      id: "pow",
      name: "Proof-of-Weight",
      verb: "Weight",
      description:
        "Seven-signal impact scoring with a published hash. Auditable rationale, not a black-box CSV.",
    },
    {
      id: "ocg",
      name: "Open Contribution Graph",
      verb: "Ingest",
      description:
        "Heterogeneous events in one graph: merges, scrobbles, streams, EXIF photos, citations, deliverables.",
    },
    {
      id: "pss",
      name: "Proportional Settlement Split",
      verb: "Settle",
      description:
        "Split a fund pool by verified weight on Arc. Multi-party by design — not a two-sided bet.",
    },
    {
      id: "wdl",
      name: "Weight Dispute Layer",
      verb: "Challenge",
      description:
        "Stake to contest a payee's share. Settlement pauses until re-weighting resolves.",
    },
  ],
} as const;

/** Problems binary markets, rug scanners, and flat payrails do not solve. */
export const PROTOCOL_GAPS = [
  {
    problem: "Split one treasury across 20 contributors fairly",
    whyOthersFail:
      "Claim markets are two-sided. Prediction markets price yes/no. Flat CSV pays equal per row.",
    resolve: "Proof-of-Weight → proportional PSS on Arc",
  },
  {
    problem: "Value types differ (code vs music vs photos vs posts)",
    whyOthersFail: "Winners pick one vertical and stay there.",
    resolve: "Open Contribution Graph with type-aware signals",
  },
  {
    problem: "Nobody knows who is unpaid until you manually list them",
    whyOthersFail: "Payment rails assume payees are already known.",
    resolve: "Unpaid Value Index scans live OSS graphs",
  },
  {
    problem: "Dispute 'contributor A deserves 50%' before paying",
    whyOthersFail: "Escrow releases to predefined splits. Markets need opposing sides.",
    resolve: "Weight Dispute Layer with stake and pause",
  },
  {
    problem: "Verify scoring methodology without trusting the operator",
    whyOthersFail: "Closed dashboards hide how numbers were computed.",
    resolve: "Open-source signals + weight proof hash on every batch",
  },
];

export const DECENTRALIZATION = {
  openSource: "https://github.com/velz-cmd/Things-to-do",
  settlement: "Arc USDC memo batches — verifiable on explorer",
  registry: "Contributor registry — platform-agnostic wallet mapping",
  proofs: "weightProofHash committed per distribution batch",
  disputes: "Permissionless challenge endpoint — no admin approval",
  data: "Ingest any webhook or CSV into OCG — no vendor lock-in",
};
