/** Plain-language copy — bootstrap doctrine: fulfill obligations, don't invent value */

export const CAPITAL_YIELD_COPY = {
  ecosystemTitle: "Fulfillment & match pools",
  ecosystemSubtitle:
    "Value already exists upstream. Founders operate programs. Funders fulfill what's owed — or seed QF match pools that amplify Open Collective contributions.",

  roles: {
    creator: {
      title: "Creators & contributors",
      benefit:
        "Earn when connectors recognize your work. You've earned $X — settlement pending funding.",
    },
    funder: {
      title: "Any funder",
      benefit:
        "Clear the authorization queue or fund a QF match pool. Track fulfillment ratio or match leverage toward 2× — verified value, not stock returns.",
    },
    founder: {
      title: "Founder / operator",
      benefit:
        "Install programs and connect sensors — you fulfill obligations, you don't decide who deserves pay. Retainers and operator fees where programs define them.",
    },
    operator: {
      title: "Community operators",
      benefit: "Connect GitHub, Open Collective, Jellyfin once — strangers can fulfill without knowing you.",
    },
    platform: {
      title: "RESOLVE rail",
      benefit: "Authorize at event time, settle in batches on Arc. We don't subsidize from platform treasury.",
    },
  },

  yieldExplainer: {
    title: "What 2× means (honest)",
    body:
      "For bounties and royalties: 2× fulfillment = every $1 you fund clears $2+ in settled + claimable authorizations. For QF (RFB #6): 2× match leverage = every $1 in the match pool unlocked $2+ in community contributions + matched payouts.",
    formula: "Value exists → authorization → funder fulfills → creator claims",
  },

  discover: {
    title: "Fulfill a community program",
    subtitle:
      "Sorted by pending obligations and where capital unlocks verified value — no insider knowledge required.",
    fundCta: "Fund match pool",
    fundFulfillCta: "Fulfill program",
    viewCta: "View community",
    targetBadge: "2× target met",
    impactLabel: "Verified value",
    gapLabel: "Pending fulfillment",
    multiplierLabel: "Leverage",
    minFund: "From $5",
    qfLabel: "Match leverage",
    fulfillmentLabel: "Fulfillment ratio",
  },

  portfolio: {
    title: "Your funded programs",
    empty: "You haven't funded a program yet — browse obligations below.",
    targetMet: "2× target met",
    building: "Building leverage",
    principal: "You funded",
    impact: "Value unlocked",
    fulfilled: "Released to creators",
  },
} as const;
