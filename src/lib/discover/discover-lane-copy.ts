/** Lane purpose copy — action marketplace, not dashboard inspection. */

export const DISCOVER_HERO_TITLE = "What value do you want to unlock?";

export const DISCOVER_HERO_SUBTITLE =
  "Find verified work, missing payout rules, unpaid creators, and underfunded communities. Act in one click: create programs, fund pools, start analysis, connect sources, or claim earnings.";

export const DISCOVER_SECTION = {
  /** Workspace tab + fulfillment queue — fund programs and community gaps */
  fundingBoard: "Ready to Fund",
  /** Relationship graph + node operator console */
  valueGraph: "Value graph",
} as const;

export const WORKSPACE_LANE_LABELS = {
  gaps: "Unpaid Value",
  radars: "Live Signals",
  board: DISCOVER_SECTION.fundingBoard,
} as const;

export const LANE_PURPOSE = {
  gaps: "Verified activity exists, but no payout rule is active yet.",
  radars: "Recent proof signals that can trigger a rule, Mission analysis, funding, or payout.",
  board: "Ready-to-act programs and fundable gaps. Move Arc USDC or open Communities with context.",
} as const;
