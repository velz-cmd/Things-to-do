/** Lane purpose copy — action marketplace, not dashboard inspection. */

export const DISCOVER_HERO_TITLE = "What value do you want to unlock?";

export const DISCOVER_HERO_SUBTITLE =
  "Find verified work, missing payout rules, unpaid creators, and underfunded communities. Act in one click: create programs, fund pools, run agents, connect sources, or claim earnings.";

export const DISCOVER_SECTION = {
  /** Workspace tab + fulfillment queue — fund programs and community gaps */
  fundingBoard: "Funding board",
  /** Relationship graph + node operator console */
  valueGraph: "Value graph",
} as const;

export const WORKSPACE_LANE_LABELS = {
  gaps: "Unpaid Value",
  radars: "Live Signals",
  board: "Ready to Fund",
} as const;

export const LANE_PURPOSE = {
  gaps: "Verified activity exists, but no payout rule is active yet.",
  radars: "Recent proof signals that can trigger a rule, agent run, funding, or payout.",
  board: "Ready-to-act programs and fundable gaps. Move Arc USDC or open Communities with context.",
} as const;
