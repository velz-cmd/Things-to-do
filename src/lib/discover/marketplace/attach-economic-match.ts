import {
  matchImpactToCapital,
  type CoverageRecord,
  type EconomicMatch,
  type FundingIntentCandidate,
} from "@/lib/discover/impact/economic-matching";
import {
  resolveCanonicalEconomicStateFromMatch,
  type CanonicalPayoutState,
} from "@/lib/discover/marketplace/economic-state";
import type { DiscoverEntityState, DiscoverPool, MarketplaceOpportunity } from "./contracts";

/**
 * Bridges the matching engine to the live marketplace.
 *
 * The engine decides what may legitimately fund an outcome; this module is
 * only responsible for describing the funding intents that genuinely exist in
 * the projection, so the engine never reasons about invented capital.
 */

/**
 * The class of outcome a Pool is mandated to fund, taken from the Pool's own
 * recorded type. Never inferred from a title.
 */
function poolOutcomeClasses(pool: DiscoverPool): string[] {
  const type = pool.type.toLowerCase();
  if (type.includes("security")) return ["security"];
  if (type.includes("royalt") || type.includes("creator")) return ["creator"];
  if (type.includes("research") || type.includes("citation")) return ["research"];
  if (type.includes("quadratic") || type.includes("grant")) return [];
  return [];
}

/** The class of an outcome, from its own recorded category/type only. */
export function outcomeClassFor(item: MarketplaceOpportunity): string {
  const category = item.category?.toLowerCase();
  if (category) return category;
  switch (item.type) {
    case "creator_collaboration":
      return "creator";
    case "research_request":
    case "research_outcome":
      return "research";
    case "repository_fix":
      return "software";
    default:
      return "software";
  }
}

/**
 * Pools become funding intents. A Pool that cannot move capital is still
 * included - the engine reports it as excluded with its real blocker, which is
 * more useful to a funder than hiding it.
 */
export function fundingIntentsFromPools(
  pools: DiscoverPool[],
): FundingIntentCandidate[] {
  return pools.map((pool) => ({
    id: pool.id,
    mechanism: "pool_allocation" as const,
    label: pool.name,
    eligibleClasses: poolOutcomeClasses(pool),
    availableUsd: pool.availableUsd ?? 0,
    executable: pool.lifecycleState === "accepting_funding",
    blocker:
      pool.blocker ??
      (pool.lifecycleState === "setup_incomplete"
        ? `${pool.name} has not finished setup, so it cannot allocate capital yet.`
        : undefined),
    requiresRole: "operator" as const,
  }));
}

/**
 * Direct support is the viewer's own voluntary intent, not a RESOLVE judgement
 * that the work deserves money. It is only offered when the recipient can
 * actually settle.
 */
export function directSupportIntent(input: {
  recipientReady: boolean;
  blocker?: string;
}): FundingIntentCandidate {
  return {
    id: "direct_support",
    mechanism: "direct_support",
    label: "Direct support from you",
    eligibleClasses: [],
    availableUsd: Number.MAX_SAFE_INTEGER,
    executable: input.recipientReady,
    blocker: input.blocker,
  };
}

/**
 * Beneficiary identity and payout identity are separate (Phase 5 section
 * 18) - `financialReadiness` already IS that payout dimension for verified
 * work, just under domain-specific naming. This maps it into the
 * canonical vocabulary once, rather than each consumer reinventing the
 * mapping.
 */
function payoutFromFinancialReadiness(
  financialReadiness: DiscoverEntityState["financialReadiness"] | undefined,
): CanonicalPayoutState {
  switch (financialReadiness) {
    case "not_applicable":
      return "not_required";
    case "setup_required":
      return "destination_missing";
    case "ready":
    case "submitted":
    case "confirmed":
      return "destination_ready";
    default:
      return "unknown_recipient";
  }
}

export type EconomicMatchInput = {
  pools: DiscoverPool[];
  viewerUserId?: string;
  /** Prior payments known for a given work source id. */
  coverageBySourceId?: Map<string, CoverageRecord[]>;
  /** Source ids the viewer operates a Pool for. */
  operatorOfPoolIds?: Set<string>;
};

/**
 * Attaches an EconomicMatch to every verified-work item, so the marketplace
 * can show why capital may or may not fund it instead of a bare button.
 */
export function attachEconomicMatch(
  opportunities: MarketplaceOpportunity[],
  input: EconomicMatchInput,
): MarketplaceOpportunity[] {
  const poolIntents = fundingIntentsFromPools(input.pools);

  return opportunities.map((item) => {
    // Phase 3/5: research and media outcomes feed into the same
    // deterministic matcher as software work - a real Research/Creator
    // Pool can match a real publication or verified listen, but citation
    // count or play count alone never manufactures demand (hasSourcedImpact
    // below only gates delegated-capital eligibility, never the recommended
    // amount, which always comes from the intent's own availableUsd).
    //
    // Phase 5 fix: listenbrainz_listen was excluded here entirely, so a
    // real Creator Pool could never match a media outcome even though
    // poolOutcomeClasses()/outcomeClassFor() both already handle the
    // "creator" class correctly - the match was unreachable, not absent.
    if (
      item.source.type !== "github_evidence" &&
      item.source.type !== "research_work" &&
      item.source.type !== "listenbrainz_listen"
    ) {
      return item;
    }

    const recipientReady =
      item.entityState?.financialReadiness === "ready";
    const intents = [
      ...poolIntents,
      directSupportIntent({
        recipientReady,
        blocker: item.entityState?.blocker,
      }),
    ];

    // Only sourced adoption/outcome evidence counts. An impactProfile that
    // states impact is not measurable must not unlock delegated capital.
    const hasSourcedImpact =
      item.impactProfile?.measurable === true &&
      item.impactProfile.signals.length > 0;

    const coverage =
      input.coverageBySourceId?.get(item.source.id) ?? ([] as CoverageRecord[]);

    const match = matchImpactToCapital({
      outcomeClass: outcomeClassFor(item),
      purpose: "verified outcome support",
      hasSourcedImpact,
      intents,
      coverage,
      viewerRoles: input.operatorOfPoolIds?.size ? ["operator"] : [],
    });

    // Release Slice 3: wire the canonical projection into the real
    // marketplace. `economicMatch` remains the source of truth for
    // mechanism eligibility; `economicState` is the one canonical current
    // state derived from it, so a component reads one field instead of
    // reimplementing the same precedence logic each time.
    const economicState = resolveCanonicalEconomicStateFromMatch({
      match,
      payout: payoutFromFinancialReadiness(item.entityState?.financialReadiness),
    });

    return { ...item, economicMatch: match, economicState } satisfies MarketplaceOpportunity;
  });
}

export type { EconomicMatch };
