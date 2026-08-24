import {
  matchImpactToCapital,
  type CoverageRecord,
  type EconomicMatch,
  type FundingIntentCandidate,
} from "@/lib/discover/impact/economic-matching";
import {
  computeObligationId,
  computePolicyFingerprint,
  periodForMechanism,
  resolveCanonicalEconomicStateFromMatch,
  resolveSettlementStateFromCoverage,
  type CanonicalPayoutState,
} from "@/lib/discover/marketplace/economic-state";
import type { PersistedPolicyProvenance } from "@/lib/discover/marketplace/policy-provenance-bridge";
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
 * Release Slice 6: a funded, public Campaign/Request is real explicit
 * demand (Phase 5 section 14) - "funded_request" was already a real
 * FundingMechanism value in economic-matching.ts, but nothing in this
 * codebase ever actually constructed one. The mechanism was defined but
 * unreachable, the same class of bug already found and fixed for media
 * Pool matching (Release Slice 0/attach-economic-match's original gap).
 *
 * A Campaign's remaining budget is its own goal minus what it has already
 * committed - never re-derived from anything else. An expired or
 * fully-committed Campaign is still included (excluded, with its real
 * reason), matching the existing Pool pattern: showing why capital can't
 * currently fund something is more useful than hiding it.
 */
function campaignOutcomeClasses(item: MarketplaceOpportunity): string[] {
  const category = item.category?.trim().toLowerCase();
  return category ? [category] : [];
}

export function fundingIntentsFromCampaigns(
  opportunities: MarketplaceOpportunity[],
): FundingIntentCandidate[] {
  return opportunities
    .filter((item) => item.source.type === "outcome_campaign")
    .map((item) => {
      const goalUsd = item.funding?.goalAmountUsd ?? 0;
      const fundedUsd = item.funding?.fundedAmountUsd ?? 0;
      const availableUsd = Math.max(goalUsd - fundedUsd, 0);
      const expired = item.deadline != null && new Date(item.deadline).getTime() < Date.now();
      const blocker = expired
        ? `${item.title}'s funding deadline has passed.`
        : availableUsd <= 0
          ? `${item.title}'s budget is already fully committed.`
          : undefined;
      return {
        id: item.source.id,
        mechanism: "funded_request" as const,
        label: item.title,
        eligibleClasses: campaignOutcomeClasses(item),
        availableUsd,
        executable: item.status === "open" && !expired && availableUsd > 0,
        blocker,
      };
    });
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
  /**
   * Release Slice 13: whether `coverageBySourceId` was actually fully
   * retrieved. Defaults to true (every pre-existing caller keeps its exact
   * prior behavior). When false, every item this function processes gets
   * `economicState.state === "verification_unavailable"` instead of
   * silently treating `coverageBySourceId`'s emptiness as "verified: no
   * prior payment" - UNKNOWN != EMPTY. See coverage-loader.ts.
   */
  coverageDataAvailable?: boolean;
  /** Source ids the viewer operates a Pool for. */
  operatorOfPoolIds?: Set<string>;
  /** Release Slice 9: real persisted policy provenance per Pool/Program id, from the read-only bridge (never invented here). */
  policyProvenanceByProgramId?: Map<string, PersistedPolicyProvenance>;
  /**
   * Release Slice 13: whether `policyProvenanceByProgramId` was actually
   * fully retrieved. Defaults to true. When false, a winning mechanism's
   * `policyProvenance` is labeled "unavailable" rather than silently
   * downgraded to "provisional" - ABSENT POLICY != POLICY LOOKUP FAILED.
   * See policy-provenance-bridge.ts.
   */
  policyProvenanceAvailable?: boolean;
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
  const campaignIntents = fundingIntentsFromCampaigns(opportunities);

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
      ...campaignIntents,
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

    // Release Slice 7: purpose was a single hardcoded generic string for
    // every outcome regardless of domain. Coverage is looked up per-work
    // (by source.id), so this never caused a cross-work collision - but
    // it also meant a real Campaign's own objective, or a specific
    // work's own title, was discarded in favor of a placeholder. The
    // work's own title is real, specific, and already exists on every
    // item reaching this matcher - using it costs nothing and makes
    // overlap comparisons ("a prior payment for a different purpose")
    // describe something real instead of a generic phrase.
    //
    // Release Slice 14: real obligation identity, computed with the exact
    // same inputs wallet/send/route.ts uses when it PERSISTS one at
    // settlement time (mechanism "direct_support", canonicalSubjectId =
    // item.source.id, purpose = item.title, beneficiaryId =
    // item.creator.id) - when they match, assessOverlap()'s exact-
    // obligation comparison genuinely engages against real prior coverage
    // instead of always falling through to the weaker purpose-text match.
    // Only computable for a github_evidence work item with a resolved
    // recipient - Pool/Request mechanisms aren't known until AFTER
    // matching resolves them, so no equivalent candidate exists for those
    // (the same real constraint that already existed before this slice,
    // not introduced by it).
    const directSupportObligationId =
      item.source.type === "github_evidence" && item.creator.id
        ? computeObligationId({
            mechanism: "direct_support",
            canonicalSubjectId: item.source.id,
            purpose: item.title,
            period: periodForMechanism("direct_support") ?? { kind: "one_time" },
            beneficiaryId: item.creator.id,
            policyFingerprint: computePolicyFingerprint({
              mechanism: "direct_support",
              eligibleClasses: [],
              amountRule: null,
              subjectId: "direct_support",
            }),
          })
        : undefined;

    const match = matchImpactToCapital({
      outcomeClass: outcomeClassFor(item),
      purpose: item.title,
      obligationId: directSupportObligationId,
      hasSourcedImpact,
      intents,
      coverage,
      viewerRoles: input.operatorOfPoolIds?.size ? ["operator"] : [],
    });

    // Release Slice 9: real policy provenance for the recommended
    // mechanism, when one is a Pool with a persisted PolicyVersion (via
    // the read-only bridge - never invented, never written here). No
    // persisted policy exists for most Pools today, so this falls back to
    // a provisional fingerprint computed from the winning intent's own
    // currently-visible rules - real and reproducible, just not yet
    // backed by a persisted row. Every current mechanism (Pool allocation,
    // funded Request, direct support) pays a one-time reward - period
    // "one_time" is the correct real period today, not a gap.
    const winningIntent = match.recommended
      ? match.eligible.find((entry) => entry.intent.mechanism === match.recommended)?.intent
      : undefined;
    const persistedPolicy = winningIntent
      ? input.policyProvenanceByProgramId?.get(winningIntent.id)
      : undefined;
    // Release Slice 13: subjectId included so two different funding
    // intents with the same mechanism/eligibleClasses (e.g. two unrelated
    // "creator" Pools) never collide into the same provisional fingerprint
    // - see PolicyRules's doc comment in economic-state.ts.
    const provisionalFingerprint = winningIntent
      ? computePolicyFingerprint({
          mechanism: winningIntent.mechanism,
          eligibleClasses: winningIntent.eligibleClasses,
          amountRule: null,
          subjectId: winningIntent.id,
        })
      : undefined;
    const policyProvenanceAvailable = input.policyProvenanceAvailable ?? true;

    // Release Slice 3: wire the canonical projection into the real
    // marketplace. `economicMatch` remains the source of truth for
    // mechanism eligibility; `economicState` is the one canonical current
    // state derived from it, so a component reads one field instead of
    // reimplementing the same precedence logic each time.
    // Release Slice 10: real settlement state, derived from the same real
    // coverage records already loaded (Slice 8) - see
    // resolveSettlementStateFromCoverage()'s doc comment for why confirmed
    // coverage is deliberately left to the resolver's existing
    // duplicate_obligation/fully_covered precedence rather than
    // short-circuited here.
    const { settlementState, reconciliationIssue } = resolveSettlementStateFromCoverage(coverage);

    const economicState = resolveCanonicalEconomicStateFromMatch({
      match,
      purpose: item.title,
      payout: payoutFromFinancialReadiness(item.entityState?.financialReadiness),
      policyFingerprint: persistedPolicy?.policyFingerprint ?? provisionalFingerprint,
      policyProvenance: persistedPolicy
        ? "persisted"
        : winningIntent
          ? (policyProvenanceAvailable ? "provisional" : "unavailable")
          : undefined,
      // Release Slice 13: real per-mechanism period, not a blanket
      // one_time - see periodForMechanism()'s doc comment.
      period: winningIntent ? periodForMechanism(winningIntent.mechanism) : undefined,
      settlementState,
      reconciliationIssue,
      coverageDataAvailability: input.coverageDataAvailable === false ? "unavailable" : "available",
    });

    return { ...item, economicMatch: match, economicState } satisfies MarketplaceOpportunity;
  });
}

export type { EconomicMatch };
