/** Lane purpose copy — action marketplace, not dashboard inspection. */

export const DISCOVER_HERO_SUBTITLE = "Where should value move next?";

export const DISCOVER_SECTION = {
  /** Workspace tab + fulfillment queue — fund programs and community gaps */
  fundingBoard: "Funding board",
  /** Relationship graph + node operator console */
  valueGraph: "Value graph",
} as const;

export const WORKSPACE_LANE_LABELS = {
  gaps: "Unpaid Value",
  radars: "Live Signals",
  board: DISCOVER_SECTION.fundingBoard,
} as const;

export const LANE_PURPOSE = {
  gaps: "Verified work with no reward program yet — create or fund in one click.",
  radars: "Proof arriving right now — react, automate, or run analysis.",
  board: "Ranked programs and fundable gaps — move Arc USDC, then operate in Communities.",
} as const;
