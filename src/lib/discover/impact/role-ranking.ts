/**
 * Role-aware ranking for Discover.
 *
 * One marketplace, three questions. The same canonical items are ordered
 * differently depending on what the viewer can actually do:
 *
 *   funder      — where can my capital produce useful effect?
 *   contributor — where is useful funded work I can perform?
 *   operator    — what needs my review, resolution, or distribution?
 *
 * This deliberately does NOT filter the marketplace into three products.
 * Every viewer sees the same items; only ordering changes, so nothing
 * becomes invisible because of a role guess.
 *
 * Ranking is deterministic and derived from canonical state (executability,
 * sourced impact, blockers, coverage). It never invents a quality score, and
 * it never uses popularity.
 */

export type DiscoverRole = "funder" | "contributor" | "operator";

/** The ranking-relevant facts about one marketplace item. */
export type RankableItem = {
  id: string;
  /** True when a real economic action can execute right now. */
  actionable: boolean;
  /** True when sourced adoption/outcome evidence exists. */
  hasSourcedImpact: boolean;
  /** True when capital is already committed and waiting. */
  hasFundingIntent: boolean;
  /** True when the item still needs money. */
  uncovered: boolean;
  /** True when only this viewer can clear the blocker. */
  needsViewerResolution: boolean;
  /** True when the viewer is being paid, rather than paying. */
  earnable: boolean;
  /** Recency tiebreaker, ISO timestamp. */
  updatedAt: string;
};

/**
 * Weights per role. Positive values promote; the sort is stable so equal
 * scores preserve the upstream canonical order.
 *
 * Every signal here is about the item's economic situation, never about
 * popularity or volume of activity.
 */
const ROLE_WEIGHTS: Record<DiscoverRole, Partial<Record<keyof RankableItem, number>>> = {
  // Capital looking for effect: prefer things it can actually fund now,
  // that are demonstrably real, and that nobody has covered yet.
  funder: {
    actionable: 5,
    hasSourcedImpact: 4,
    uncovered: 3,
    hasFundingIntent: 1,
  },
  // Someone looking for paid work: prefer work that pays and is claimable.
  contributor: {
    earnable: 5,
    hasFundingIntent: 4,
    actionable: 3,
  },
  // Someone maintaining the system: prefer what is stuck on them.
  operator: {
    needsViewerResolution: 6,
    actionable: 2,
    hasFundingIntent: 2,
  },
};

export function scoreForRole(item: RankableItem, role: DiscoverRole): number {
  const weights = ROLE_WEIGHTS[role];
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (item[key as keyof RankableItem] === true) score += weight ?? 0;
  }
  return score;
}

/**
 * Infers the viewer's primary role from what they can actually do, not from
 * a stored preference. Operator wins when something is blocked on them,
 * because that is time-sensitive and only they can clear it.
 */
export function inferPrimaryRole(input: {
  operatesPools: boolean;
  hasSpendableCapital: boolean;
  hasPayoutDestination: boolean;
}): DiscoverRole {
  if (input.operatesPools) return "operator";
  if (input.hasSpendableCapital) return "funder";
  if (input.hasPayoutDestination) return "contributor";
  // No capital and no payout destination yet - funding is the action that
  // needs no setup on the viewer's side, so lead with it.
  return "funder";
}

/**
 * Stable, deterministic ordering. Items are never dropped - a zero score
 * simply sorts last, so a role guess can never hide the marketplace.
 */
export function rankForRole<T extends RankableItem>(
  items: T[],
  role: DiscoverRole,
): T[] {
  return items
    .map((item, index) => ({ item, index, score: scoreForRole(item, role) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const byRecency = b.item.updatedAt.localeCompare(a.item.updatedAt);
      if (byRecency !== 0) return byRecency;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
