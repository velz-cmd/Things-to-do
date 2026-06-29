/** Plain-language copy for Community Yield — funders, creators, operators */

export const CAPITAL_YIELD_COPY = {
  ecosystemTitle: "Community Yield",
  ecosystemSubtitle:
    "Everyone benefits when value is verified first and money follows. You don't need to know a community — browse programs, fund what resonates, track verified impact.",

  roles: {
    creator: {
      title: "Creators & contributors",
      benefit: "Earn from work that already happens upstream — claim when programs are funded.",
    },
    funder: {
      title: "Any funder",
      benefit:
        "Stake on a program. When verified impact reaches 2× your stake, your capital did its job — creators got paid, community grew.",
    },
    operator: {
      title: "Community operators",
      benefit: "Install once, let anyone fund your program — you focus on community, not chasing donors.",
    },
    platform: {
      title: "RESOLVE rail",
      benefit: "Escrow + verification + receipts — we don't subsidize payouts from our own treasury.",
    },
  },

  yieldExplainer: {
    title: "What 2× means (honest)",
    body:
      "2× is verified economic impact — not a guaranteed stock return. If you fund $100 and the program generates $200+ in settled and recognized creator value, your stake hit the target. You keep public proof, portfolio history, and the community keeps creators.",
    formula: "Impact = paid out + ready to collect + half of recognized pipeline + contributor reach",
  },

  discover: {
    title: "Fund a community program",
    subtitle: "No insider knowledge required — sorted by where capital unlocks the most verified value.",
    fundCta: "Fund program",
    viewCta: "View community",
    targetBadge: "2× impact target",
    impactLabel: "Verified impact",
    gapLabel: "To reach 2×",
    multiplierLabel: "Impact multiplier",
    minFund: "From $5",
  },

  portfolio: {
    title: "Your funded programs",
    empty: "You haven't funded a program yet — discover one below.",
    targetMet: "Target met",
    building: "Building impact",
    principal: "You funded",
    impact: "Your share of impact",
  },
} as const;
