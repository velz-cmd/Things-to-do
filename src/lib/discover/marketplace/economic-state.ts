import { createHash } from "node:crypto";
import type {
  CoverageRecord,
  EconomicMatch,
  FundingMechanism,
} from "@/lib/discover/impact/economic-matching";
import type {
  ContributorReadiness,
  FundingAmountState,
  FundingCoverageLedgerRecord,
} from "@/lib/discover/funding-coverage";

/**
 * Canonical economic state (Phase 5, Release Slice 1).
 *
 * Discover has had two parallel economic-truth systems: `EconomicMatch`
 * (economic-matching.ts - real, deterministic mechanism eligibility and
 * overlap) and funding-coverage.ts's separate GitHub-specific
 * `FundingAmountState`/`FundingSettlementState`/`ContributorReadiness`
 * enums. Consumers (row rendering, the Command Centre, action resolution)
 * each derived their own notion of "what state is this outcome in," which
 * risks Verified Work saying one thing and the Command Centre saying
 * another for the same real money.
 *
 * This module is the single canonical projection every domain funnels
 * through. It does NOT replace `EconomicMatch` (which remains the correct
 * place to decide "which mechanism may fund this") or funding-coverage.ts
 * (which remains the correct place for GitHub-specific operational detail
 * - accepted-work evidence, repository payout state). It consumes both as
 * INPUT and produces one canonical current state plus the supporting
 * dimensions (coverage amounts, payout, settlement, authorization) that
 * state was derived from, so a caller who needs the detail still has it.
 *
 * Deterministic by construction, exactly like `EconomicMatch`: the state
 * is a pure function of its inputs, never inferred by a model.
 */

/** One canonical current state. Never render several contradictory ones. */
export type CanonicalEconomicStateValue =
  | "no_demand"
  | "demand_found"
  | "possible_match"
  | "eligible"
  | "funding_available"
  | "authorization_required"
  | "payout_setup_required"
  | "partially_covered"
  | "fully_covered"
  | "settlement_submitted"
  | "settlement_confirming"
  | "settlement_confirmed"
  | "reconciliation_required"
  | "verification_unavailable"
  | "blocked";

/**
 * Beneficiary identity and payout identity are separate (Phase 5 section
 * 18). "recipient_identified" means RESOLVE knows who the beneficiary is;
 * it does NOT mean they have a verified place to receive money.
 */
export type CanonicalPayoutState =
  | "not_required"
  | "unknown_recipient"
  | "recipient_identified"
  | "destination_missing"
  | "destination_ready"
  | "blocked";

/** Real settlement lifecycle. Never invented independent of authoritative chain/receipt truth. */
export type CanonicalSettlementState =
  | "not_started"
  | "authorization_required"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "reconciliation_required";

/**
 * Amount-based coverage (Phase 5 section 6/7). A submitted-but-unconfirmed
 * transaction is `pendingUsd`, never folded into `confirmedUsd` - "pending
 * != confirmed" is a hard product invariant, not a display nuance.
 */
export type CanonicalCoverage = {
  /** Amount actually needed, when known. Null when no obligation amount exists yet. */
  requiredUsd: number | null;
  /** Sum of CONFIRMED prior payments only. */
  confirmedUsd: number;
  /** Sum of submitted-but-unconfirmed prior payments. Never counted as coverage. */
  pendingUsd: number;
  /**
   * requiredUsd - confirmedUsd, floored at 0 (Phase 5 section 8: overfunding
   * never produces a negative remaining amount). Null when requiredUsd is
   * unknown, since "remaining" is meaningless without a required amount.
   */
  remainingUsd: number | null;
  currency: "USDC";
  /** The real records this was computed from, for auditability. */
  records: CoverageRecord[];
  /** True only when requiredUsd is known and confirmedUsd meets or exceeds it. */
  fullyCovered: boolean;
  /**
   * Release Slice 13: whether the underlying coverage source was actually
   * retrievable. "unavailable" means the lookup itself failed (a real DB
   * error) - UNKNOWN != EMPTY. `confirmedUsd`/`pendingUsd` are 0 in that
   * case only because nothing could be read, never because RESOLVE
   * verified there is genuinely no prior payment. A money-mutation
   * decision must never treat "unavailable" as "zero coverage, safe to
   * fund" - see resolveCanonicalEconomicStateFromMatch's
   * "verification_unavailable" state, which exists specifically to make
   * this distinction impossible to skip.
   */
  dataAvailability: "available" | "unavailable";
};

export type CanonicalObligation = {
  amountUsd: number | null;
  purpose: string;
  mechanism: FundingMechanism | null;
  /**
   * Release Slice 9: policy provenance, when a mechanism has one.
   * "persisted" means this fingerprint came from a real PolicyVersion row
   * (via the read-only bridge in policy-provenance-bridge.ts) - the
   * authoritative source once a policy engine has actually created one.
   * "provisional" means the lookup itself succeeded and genuinely found no
   * persisted policy, so this is a deterministic fingerprint computed from
   * the mechanism's own currently-visible rules (computePolicyFingerprint())
   * - a real, reproducible value, not invented, but not yet backed by a
   * persisted row. "unavailable" (Release Slice 13) means the lookup
   * itself FAILED (a real DB error) - this must never be silently folded
   * into "provisional": ABSENT POLICY != POLICY LOOKUP FAILED. Absent
   * entirely for mechanisms with no policy concept (e.g. an individual's
   * own direct_support has no "policy").
   */
  policyFingerprint?: string;
  policyProvenance?: "persisted" | "provisional" | "unavailable";
  /** A one-time work reward is genuinely one-time - not a gap, the correct period for this mechanism today. */
  period?: CanonicalPeriod;
};

export type CanonicalNextAction =
  | "review_funding"
  | "fund"
  | "set_payout"
  | "authorize"
  | "view_receipt"
  | "none";

export type CanonicalEconomicState = {
  state: CanonicalEconomicStateValue;
  /** Does any real funding intent/mechanism exist for this outcome at all. */
  demand: boolean;
  eligibility: { eligible: boolean; reason: string };
  /** Null when no real obligation/match exists - "no demand" is a legitimate result. */
  obligation: CanonicalObligation | null;
  coverage: CanonicalCoverage;
  authorization: { required: boolean; granted: boolean };
  payout: CanonicalPayoutState;
  settlement: CanonicalSettlementState;
  mechanism: FundingMechanism | null;
  /** Which domain-specific system this projection was built from, for debugging. */
  provenance: "economic_match" | "funding_coverage";
  /** The single legitimate next action for this state. Never more than one. */
  nextAction: CanonicalNextAction;
  /**
   * Present only when state is "reconciliation_required" - the specific
   * real inconsistency a human needs to resolve (Release Slice 5). Never
   * populated speculatively; absence here means no known inconsistency,
   * not "checked and clean" (reconciliation detection requires real
   * settlement facts the caller must supply).
   */
  reconciliation?: ReconciliationIssue;
};

/**
 * Sums confirmed vs. pending coverage from real records and computes the
 * remaining gap. `status` absent on a record means confirmed (see
 * CoverageRecord's own doc comment) - this preserves every pre-existing
 * caller's behavior exactly.
 */
export function computeCanonicalCoverage(
  records: CoverageRecord[],
  requiredUsd: number | null,
  dataAvailability: "available" | "unavailable" = "available",
): CanonicalCoverage {
  let confirmedUsd = 0;
  let pendingUsd = 0;
  for (const record of records) {
    if (record.status === "failed") continue;
    if (record.status === "pending") {
      pendingUsd += record.amountUsd;
    } else {
      confirmedUsd += record.amountUsd;
    }
  }
  const fullyCovered = requiredUsd != null && confirmedUsd >= requiredUsd;
  const remainingUsd =
    requiredUsd == null ? null : Math.max(requiredUsd - confirmedUsd, 0);
  return {
    requiredUsd,
    confirmedUsd,
    pendingUsd,
    remainingUsd,
    currency: "USDC",
    records,
    fullyCovered,
    dataAvailability,
  };
}

/** Deterministic mapping from state to the one legitimate next action. */
function nextActionFor(state: CanonicalEconomicStateValue, coverage: CanonicalCoverage): CanonicalNextAction {
  switch (state) {
    case "no_demand":
    case "demand_found":
    case "blocked":
    case "settlement_submitted":
    case "settlement_confirming":
    case "reconciliation_required":
    case "verification_unavailable":
      return "none";
    case "possible_match":
    case "eligible":
    case "partially_covered":
      return "review_funding";
    case "funding_available":
      return "fund";
    case "authorization_required":
      return "authorize";
    case "payout_setup_required":
      return "set_payout";
    case "fully_covered":
    case "settlement_confirmed":
      return coverage.confirmedUsd > 0 ? "view_receipt" : "none";
  }
}

/**
 * Release Slice 1: maps an already-computed `EconomicMatch` (plus the
 * payout/settlement facts that live outside it) into one canonical state.
 *
 * Precedence, most authoritative first:
 * 1. A real settlement already in flight or resolved (settlementState)
 *    always wins - if money is literally moving, that is the true current
 *    state regardless of what the matcher would otherwise recommend.
 * 2. The matcher's own duplicate-obligation verdict - already paid, never
 *    pay again.
 * 3. Full coverage - an absolute stop regardless of any other dimension.
 * 4. Whether the matcher requires human review (possible_overlap) - an
 *    ambiguous same-purpose prior payment means a human must confirm this
 *    is not a duplicate before ANY further money moves, so this outranks
 *    "partially covered": showing "partially covered, fund the rest" would
 *    invite paying over an unresolved overlap.
 * 5. Coverage amounts - partially covered vs. none.
 * 6. Payout readiness - a real match with nowhere for money to land is
 *    "payout_setup_required," not "funding_available."
 * 7. Whether any real mechanism was found at all.
 *
 * Release Slice 13 adds precedence 0, ABOVE all of the above: if the real
 * coverage source could not actually be verified (a DB failure, not a
 * legitimate empty result), every rule from 1-7 is unsafe to apply, because
 * `match.overlap`, `settlementState`, and `coverage.fullyCovered` are ALL
 * themselves derived from the same coverage records that failed to load -
 * they would silently read as "no prior payment," which is exactly the
 * unsafe UNKNOWN-read-as-EMPTY collapse this slice exists to prevent.
 */
export function resolveCanonicalEconomicStateFromMatch(input: {
  match: EconomicMatch;
  /**
   * The real economic purpose (e.g. item.title, or a Campaign's own
   * objective) - required, not optional, because EconomicMatch itself
   * never carries this value. A real, previously-unnoticed bug (Release
   * Slice 9): before this parameter existed, obligation.purpose was
   * populated from match.overlapReason (an overlap-reasoning SENTENCE
   * like "No prior payment is recorded for this work.") instead of the
   * actual purpose - required here specifically so that mistake cannot
   * recur silently.
   */
  purpose: string;
  requiredUsd?: number | null;
  payout: CanonicalPayoutState;
  settlementState?: CanonicalSettlementState;
  /** Release Slice 5: the specific real inconsistency, when settlementState is "reconciliation_required" or "failed". */
  reconciliationIssue?: ReconciliationIssue;
  /** Release Slice 9: real persisted policy provenance for the recommended mechanism, when one exists (never invented - see policy-provenance-bridge.ts). */
  policyFingerprint?: string;
  policyProvenance?: "persisted" | "provisional" | "unavailable";
  /** Release Slice 9: the real period this obligation covers - a one-time work reward is genuinely one-time, not a gap. */
  period?: CanonicalPeriod;
  /**
   * Release Slice 13: whether the coverage records behind `match.coverage`
   * were actually retrievable. Defaults to "available" (every pre-existing
   * caller keeps its exact prior behavior). When "unavailable", this
   * function returns "verification_unavailable" before evaluating anything
   * that depends on coverage - see the precedence-0 note above.
   */
  coverageDataAvailability?: "available" | "unavailable";
}): CanonicalEconomicState {
  const { match } = input;
  const requiredUsd = input.requiredUsd ?? null;
  const settlementState = input.settlementState ?? "not_started";
  const coverageDataAvailability = input.coverageDataAvailability ?? "available";
  const coverage = computeCanonicalCoverage(match.coverage, requiredUsd, coverageDataAvailability);
  const hasAnyIntent = match.eligible.length + match.excluded.length > 0;
  const mechanism = match.recommended;
  const obligation: CanonicalObligation | null =
    mechanism != null
      ? {
          amountUsd: requiredUsd,
          purpose: input.purpose,
          mechanism,
          policyFingerprint: input.policyFingerprint,
          policyProvenance: input.policyProvenance,
          period: input.period,
        }
      : null;

  // 0. Coverage verification itself failed - every rule below is unsafe to
  // apply (see the precedence-0 doc note above). A real mechanism must
  // exist for this to matter at all - "no demand" with no coverage lookup
  // needed is still a legitimate, honest result.
  if (coverageDataAvailability === "unavailable" && mechanism != null) {
    const state: CanonicalEconomicStateValue = "verification_unavailable";
    return {
      state,
      demand: true,
      eligibility: {
        eligible: false,
        reason: "Coverage could not be verified right now, so RESOLVE cannot safely confirm whether this has already been paid.",
      },
      obligation,
      coverage,
      authorization: { required: false, granted: false },
      payout: input.payout,
      settlement: "not_started",
      mechanism,
      provenance: "economic_match",
      nextAction: nextActionFor(state, coverage),
    };
  }

  // 1. A settlement in flight or resolved is the authoritative current fact.
  if (settlementState !== "not_started") {
    const settlementToState: Record<
      Exclude<CanonicalSettlementState, "not_started">,
      CanonicalEconomicStateValue
    > = {
      authorization_required: "authorization_required",
      submitted: "settlement_submitted",
      confirming: "settlement_confirming",
      confirmed: "settlement_confirmed",
      failed: "reconciliation_required",
      reconciliation_required: "reconciliation_required",
    };
    const state = settlementToState[settlementState];
    return {
      state,
      demand: true,
      eligibility: { eligible: true, reason: match.recommendationReason },
      obligation,
      coverage,
      authorization: {
        required: settlementState === "authorization_required",
        granted: settlementState !== "authorization_required",
      },
      payout: input.payout,
      settlement: settlementState,
      mechanism,
      provenance: "economic_match",
      nextAction: nextActionFor(state, coverage),
      reconciliation: state === "reconciliation_required" ? input.reconciliationIssue : undefined,
    };
  }

  // 2. Already settled - the matcher itself refuses to recommend paying twice.
  if (match.overlap === "duplicate_obligation") {
    const state: CanonicalEconomicStateValue = "fully_covered";
    return {
      state,
      demand: true,
      eligibility: { eligible: false, reason: match.overlapReason },
      obligation,
      coverage,
      authorization: { required: false, granted: true },
      payout: input.payout,
      settlement: "confirmed",
      mechanism: null,
      provenance: "economic_match",
      nextAction: nextActionFor(state, coverage),
    };
  }

  // 2b. Release Slice 13: a real transfer for this exact obligation/purpose
  // is already in flight (assessOverlap's "settlement_in_progress" verdict)
  // - block further spend the same way as an already-settled duplicate,
  // but never claim money has already moved (PENDING != CONFIRMED).
  if (match.overlap === "settlement_in_progress") {
    const state: CanonicalEconomicStateValue = "settlement_confirming";
    return {
      state,
      demand: true,
      eligibility: { eligible: false, reason: match.overlapReason },
      obligation,
      coverage,
      authorization: { required: false, granted: false },
      payout: input.payout,
      settlement: "confirming",
      mechanism: null,
      provenance: "economic_match",
      nextAction: nextActionFor(state, coverage),
    };
  }

  // 3-6. No real mechanism at all.
  if (mechanism == null) {
    const state: CanonicalEconomicStateValue = hasAnyIntent ? "blocked" : "no_demand";
    return {
      state,
      demand: hasAnyIntent,
      eligibility: { eligible: false, reason: match.recommendationReason },
      obligation: null,
      coverage,
      authorization: { required: false, granted: false },
      payout: input.payout,
      settlement: "not_started",
      mechanism: null,
      provenance: "economic_match",
      nextAction: nextActionFor(state, coverage),
    };
  }

  // A real mechanism exists. Full coverage is an absolute stop; an
  // unresolved review requirement outranks "partially covered" (see
  // precedence note above); only then do coverage amounts and payout
  // readiness decide between "partially covered" and "ready to fund."
  let state: CanonicalEconomicStateValue;
  if (coverage.fullyCovered) {
    state = "fully_covered";
  } else if (match.requiresReview) {
    state = "authorization_required";
  } else if (coverage.confirmedUsd > 0 || coverage.pendingUsd > 0) {
    state = "partially_covered";
  } else if (input.payout === "destination_missing" || input.payout === "unknown_recipient") {
    state = "payout_setup_required";
  } else {
    state = "funding_available";
  }

  return {
    state,
    demand: true,
    eligibility: { eligible: true, reason: match.recommendationReason },
    obligation,
    coverage,
    authorization: {
      required: match.requiresReview,
      granted: !match.requiresReview,
    },
    payout: input.payout,
    settlement: "not_started",
    mechanism,
    provenance: "economic_match",
    nextAction: nextActionFor(state, coverage),
  };
}

const CONFIRMED_AMOUNT_STATES: ReadonlySet<FundingAmountState> = new Set([
  "confirmed",
  "reconciled",
]);
const PENDING_AMOUNT_STATES: ReadonlySet<FundingAmountState> = new Set([
  "submitted",
  "partially_confirmed",
]);

function payoutFromContributorReadiness(identityState: ContributorReadiness): CanonicalPayoutState {
  switch (identityState) {
    case "ready":
      return "destination_ready";
    case "payout_blocked":
      return "destination_missing";
    case "attribution_blocked":
    case "identity_blocked":
      return "unknown_recipient";
    case "not_evaluated":
      return "unknown_recipient";
  }
}

/**
 * Release Slice 1: maps funding-coverage.ts's GitHub-specific ledger
 * record (funding-coverage.ts becomes a domain adapter, not a competing
 * state machine) into the same canonical projection `economic-matching.ts`
 * feeds. GitHub-specific operational detail (evidence state, repository,
 * policy version) stays in the ledger record itself - only the customer-
 * facing economic truth is normalized here.
 *
 * Known, documented limitation: `FundingCoverageLedgerRecord` carries a
 * single `amountUsd`, not a separate required/confirmed/pending split the
 * way `CoverageRecord[]` does. For `amountState === "partially_confirmed"`
 * this means the exact confirmed-vs-remaining split is not derivable from
 * this record shape - the canonical state still correctly reports
 * "partially_covered" (an honest state, not fabricated precision), but
 * `coverage.confirmedUsd`/`remainingUsd` are left at their conservative
 * defaults (0 confirmed, full amount pending) rather than guessing a
 * split the source data does not provide. A future slice that wants exact
 * partial amounts here needs funding-coverage.ts to expose the split.
 */
export function resolveCanonicalEconomicStateFromLedgerRecord(
  record: FundingCoverageLedgerRecord,
): CanonicalEconomicState {
  const payout = payoutFromContributorReadiness(record.identityState);
  const requiredUsd = record.amountUsd;
  const amountState = record.amountState;

  const confirmedUsd =
    requiredUsd != null && CONFIRMED_AMOUNT_STATES.has(amountState) ? requiredUsd : 0;
  const pendingUsd =
    requiredUsd != null && PENDING_AMOUNT_STATES.has(amountState) ? requiredUsd : 0;
  const fullyCovered = requiredUsd != null && confirmedUsd >= requiredUsd;
  const remainingUsd = requiredUsd == null ? null : Math.max(requiredUsd - confirmedUsd, 0);
  const coverage: CanonicalCoverage = {
    requiredUsd,
    confirmedUsd,
    pendingUsd,
    remainingUsd,
    currency: "USDC",
    records: [],
    fullyCovered,
    // This adapter's source (FundingCoverageLedgerRecord) is always
    // synchronously available - no async lookup can fail here.
    dataAvailability: "available",
  };

  const mechanism: FundingMechanism | null = record.poolName ? "pool_allocation" : null;
  const obligation: CanonicalObligation | null =
    requiredUsd != null
      ? { amountUsd: requiredUsd, purpose: record.workType, mechanism }
      : null;

  let state: CanonicalEconomicStateValue;
  let settlement: CanonicalSettlementState;
  if (amountState === "failed") {
    state = "reconciliation_required";
    settlement = "failed";
  } else if (fullyCovered) {
    state = "fully_covered";
    settlement = "confirmed";
  } else if (amountState === "submitted" || amountState === "partially_confirmed") {
    state = "partially_covered";
    settlement = amountState === "submitted" ? "submitted" : "confirming";
  } else if (amountState === "no_amount" || record.policyState === "uncovered") {
    state = record.poolState === "not_attached" && !record.poolName ? "no_demand" : "blocked";
    settlement = "not_started";
  } else if (payout === "destination_missing" || payout === "unknown_recipient") {
    state = "payout_setup_required";
    settlement = "not_started";
  } else if (amountState === "claimable" || amountState === "funding_reserved") {
    state = "funding_available";
    settlement = "not_started";
  } else {
    // modelled_estimate / policy_calculated / verified_obligation: a real
    // obligation amount exists but funding has not yet been reserved.
    state = "demand_found";
    settlement = "not_started";
  }

  return {
    state,
    demand: amountState !== "no_amount",
    eligibility: { eligible: record.policyState === "covered", reason: record.policyReason },
    obligation,
    coverage,
    authorization: { required: false, granted: true },
    payout,
    settlement,
    mechanism,
    provenance: "funding_coverage",
    nextAction: nextActionFor(state, coverage),
  };
}

/**
 * Release Slice 2: policy fingerprint, stable obligation identity, period
 * semantics, and coverage-by-obligation.
 *
 * Audit note (do not rebuild what already exists): this repo already has a
 * real, Prisma-persisted ProgramVersion/PolicyVersion/Obligation system
 * (prisma/schema.prisma - PolicyVersion.contentHash, unique on
 * [programVersionId, version]; Obligation.lineageHash, unique) wired
 * through src/lib/obligations/normalize-community.ts and consumed by the
 * separate Communities/Programs settlement routes
 * (/api/communities/[slug]/obligations, /api/settlement/batch). Discover's
 * own Pools are confirmed to be the same underlying `ResolveProgram` rows
 * (see loadProgramOpportunities() in query.ts), so that system is
 * genuinely applicable here in principle. It is NOT wired into it in this
 * slice: `ensureProgramPolicyVersion()` writes ProgramVersion/PolicyVersion
 * rows transactionally as a side effect, which is the wrong shape for a
 * marketplace READ path (a page view should not silently create database
 * rows), and connecting Discover's canonical resolver to that write-capable
 * system safely is a larger, separate piece of work. What follows are pure,
 * deterministic functions usable independent of that system today, and
 * cross-checkable against PolicyVersion.contentHash/Obligation.lineageHash
 * once a read-only bridge to it is built.
 */

/** The rules a policy applies, excluding anything that is capital STATE rather than the rule itself (availableUsd changes as money moves; the rule producing eligibility/amount does not). */
export type PolicyRules = {
  mechanism: FundingMechanism;
  eligibleClasses: string[];
  /** Fixed amount, rate, percentage, cap, or another auditable deterministic rule - never an LLM output (Phase 5 section 14). */
  amountRule: { kind: "fixed" | "rate" | "percentage" | "cap"; value: number } | null;
  /**
   * Release Slice 13: the real, unique id of the funding intent this policy
   * belongs to (a Pool/Program/Request's own `id`, already real and always
   * available on every `FundingIntentCandidate`). Required, not optional -
   * before this field existed, two DIFFERENT Pools with the same mechanism
   * and eligibleClasses (e.g. two unrelated "creator" Pools) silently
   * produced the IDENTICAL provisional fingerprint, which is exactly the
   * cross-Pool collision this fingerprint exists to prevent. This does not
   * make the fingerprint a complete semantic hash of every policy dimension
   * a Pool could have (rate/cap/period/eligible-artist scoping and similar
   * are not yet real, queryable fields anywhere in this codebase's Pool/
   * Program data model - fabricating them here would violate NO-FAKE, not
   * satisfy it) - it guarantees no two DIFFERENT funding intents ever
   * collide, which is the concrete, provable bug this closes. A genuinely
   * complete policy fingerprint remains LATER PHASE work, tracked in
   * SHIP_LEDGER, pending those real fields existing to hash.
   */
  subjectId: string;
};

/**
 * Deterministic fingerprint of a policy's rules. Equivalent policy content
 * with keys in a different order must produce the same fingerprint -
 * achieved by only ever hashing an object built with an explicit, fixed
 * key order below (never by re-hashing an arbitrary caller-supplied
 * object), and by sorting eligibleClasses (array order is not semantically
 * meaningful there - two policies eligible for ["a","b"] and ["b","a"] are
 * the same policy).
 */
export function computePolicyFingerprint(rules: PolicyRules): string {
  const stable = {
    mechanism: rules.mechanism,
    eligibleClasses: [...rules.eligibleClasses].sort(),
    amountRule: rules.amountRule
      ? { kind: rules.amountRule.kind, value: rules.amountRule.value }
      : null,
    subjectId: rules.subjectId,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/**
 * Canonical economic period for an obligation (Phase 5 section 12). Not
 * every domain is a calendar month - a one-time reward, a Request's own
 * lifetime, and a recurring creator period are different shapes - but
 * coverage comparison must be able to tell whether two obligations cover
 * the SAME period without knowing which shape it is.
 */
export type CanonicalPeriod =
  | { kind: "one_time" }
  | { kind: "calendar_month"; year: number; month: number }
  | { kind: "policy_window"; windowId: string };

/**
 * Release Slice 13: real period derivation from the mechanism that
 * actually won, instead of a blanket `{ kind: "one_time" }` applied to
 * every mechanism regardless of what it means. `FundingMechanism` already
 * includes `recurring_support` - a mechanism whose whole point is that it
 * is NOT one-time - so "every current mechanism is one_time" cannot be
 * universally true by construction. Audited every mechanism-constructing
 * site in `attach-economic-match.ts` (`fundingIntentsFromPools()`,
 * `fundingIntentsFromCampaigns()`, `directSupportIntent()`): none of them
 * construct a `recurring_support` intent today, so `funded_request`,
 * `pool_allocation`, `sponsor_program`, and `direct_support` genuinely are
 * one-time for every intent this codebase can currently produce - not a
 * convenient assumption, a verified fact about the live intent factories.
 * `recurring_support` returns `undefined` (genuinely unknown) rather than
 * a fabricated period, since no real calendar/window data exists anywhere
 * in this codebase's data model to derive one from yet - if/when a real
 * recurring intent becomes constructible, this function must not silently
 * mislabel it as one-time.
 */
export function periodForMechanism(mechanism: FundingMechanism): CanonicalPeriod | undefined {
  switch (mechanism) {
    case "funded_request":
    case "pool_allocation":
    case "sponsor_program":
    case "direct_support":
      return { kind: "one_time" };
    case "recurring_support":
      return undefined;
  }
}

/** A stable string key for a period - two obligations cover the same period iff their period keys are equal. */
export function periodKey(period: CanonicalPeriod): string {
  switch (period.kind) {
    case "one_time":
      return "one_time";
    case "calendar_month":
      return `month:${period.year}-${String(period.month).padStart(2, "0")}`;
    case "policy_window":
      return `window:${period.windowId}`;
  }
}

/**
 * Stable obligation identity (Phase 5 section 11). Two obligations are the
 * SAME obligation - and therefore idempotent/duplicate-preventable -
 * exactly when mechanism, canonical subject, purpose, period, beneficiary,
 * and policy fingerprint all match. A one-time obligation never repeats
 * (its period is always "one_time", so an identical mechanism/subject/
 * purpose/beneficiary/policy combination genuinely is the same obligation
 * if computed twice - which is the correct, desired idempotency behavior,
 * not a bug).
 */
export function computeObligationId(input: {
  mechanism: FundingMechanism;
  canonicalSubjectId: string;
  purpose: string;
  period: CanonicalPeriod;
  beneficiaryId: string;
  policyFingerprint: string;
}): string {
  const stable = {
    mechanism: input.mechanism,
    canonicalSubjectId: input.canonicalSubjectId,
    purpose: input.purpose.trim().toLowerCase(),
    period: periodKey(input.period),
    beneficiaryId: input.beneficiaryId,
    policyFingerprint: input.policyFingerprint,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/**
 * Coverage-by-obligation (Phase 5 section 7): coverage must only include
 * settlements matching the CURRENT obligation, never every payment ever
 * sent to the beneficiary. A record with no `obligationId` at all cannot
 * be proven to match, so it is excluded rather than assumed relevant -
 * silently including untagged records would let an unrelated payment
 * appear to cover this obligation.
 */
export function filterCoverageByObligation(
  records: CoverageRecord[],
  obligationId: string,
): CoverageRecord[] {
  return records.filter((record) => record.obligationId === obligationId);
}

// canonicalStateLabel() moved to economic-state-labels.ts - this file
// imports node:crypto at module scope, so nothing here may be safely
// value-imported into a client component. See that file's header comment.

/**
 * Release Slice 5: reconciliation and negative financial states (Phase 5
 * section 23/28). Real inconsistencies between what was authorized, what
 * was submitted, and what actually confirmed on-chain must surface as
 * reconciliation_required - never be silently resolved in either
 * direction (never "assume it's fine", never "assume it failed").
 *
 * A confirmed on-chain transaction with no matching persisted receipt is
 * exactly as suspicious as a receipt with no matching transaction - both
 * mean RESOLVE's own records disagree with reality, and no further
 * automatic spend against this obligation should proceed until a human
 * resolves which side is wrong.
 */
export type ReconciliationIssueKind =
  | "receipt_missing"
  | "transaction_missing"
  | "amount_mismatch"
  | "recipient_mismatch"
  | "duplicate_submission";

export type ReconciliationIssue = {
  kind: ReconciliationIssueKind;
  detail: string;
};

/**
 * Compares what was actually confirmed against what RESOLVE's own records
 * expect. Pure and deterministic - every comparison is an explicit field
 * equality/inequality check, never inferred from a probability or a model.
 * Returns the FIRST issue found (checked in a fixed order, most severe
 * first) rather than a list, since canonical state exposes one current
 * state and reconciliation_required already means "stop and get a human"
 * regardless of how many things disagree.
 */
export function detectReconciliationIssue(input: {
  /** Whether a confirmed on-chain transaction hash exists for this obligation. */
  chainConfirmed: boolean;
  /** Whether a persisted RESOLVE receipt exists for this obligation. */
  receiptExists: boolean;
  /** The amount RESOLVE's own record expected to settle, in USD. */
  expectedAmountUsd: number;
  /** The amount the chain transaction actually moved, in USD. Undefined when no transaction exists yet. */
  confirmedAmountUsd?: number;
  /** The recipient RESOLVE's own record expected to receive funds. */
  expectedRecipientId: string;
  /** The recipient the chain transaction actually paid. Undefined when no transaction exists yet. */
  confirmedRecipientId?: string;
  /** True when another obligation already claims this same transaction hash. */
  isDuplicateSubmission: boolean;
}): ReconciliationIssue | null {
  if (input.isDuplicateSubmission) {
    return {
      kind: "duplicate_submission",
      detail: "This transaction is already recorded against a different obligation.",
    };
  }
  if (input.chainConfirmed && !input.receiptExists) {
    return {
      kind: "receipt_missing",
      detail: "A transaction confirmed on-chain, but no matching RESOLVE receipt was persisted.",
    };
  }
  if (input.receiptExists && !input.chainConfirmed) {
    return {
      kind: "transaction_missing",
      detail: "A RESOLVE receipt exists, but no matching on-chain confirmation was found.",
    };
  }
  if (
    input.chainConfirmed &&
    input.confirmedAmountUsd != null &&
    input.confirmedAmountUsd !== input.expectedAmountUsd
  ) {
    return {
      kind: "amount_mismatch",
      detail: `Expected ${input.expectedAmountUsd.toFixed(2)} USDC to settle, but the confirmed transaction moved ${input.confirmedAmountUsd.toFixed(2)} USDC.`,
    };
  }
  if (
    input.chainConfirmed &&
    input.confirmedRecipientId != null &&
    input.confirmedRecipientId !== input.expectedRecipientId
  ) {
    return {
      kind: "recipient_mismatch",
      detail: "The confirmed transaction's recipient does not match the expected beneficiary.",
    };
  }
  return null;
}

/**
 * Release Slice 10: real settlement state fed into the canonical resolver
 * from the same real coverage records already loaded (Release Slice 8's
 * `loadCoverageBySourceId()`) - no new query, no inferred timestamps.
 *
 * Deliberately does NOT special-case a confirmed record into
 * `settlementState: "confirmed"` here: `resolveCanonicalEconomicStateFromMatch()`'s
 * existing precedence (duplicate_obligation / fully_covered, both already
 * derived from these same coverage records) already correctly handles
 * confirmed payment, including the important eligibility=false /
 * overlapReason nuance for a fully-paid obligation. Short-circuiting that
 * through settlementState here would silently discard that nuance - not a
 * gap this slice should "fix" by overriding already-correct behavior.
 *
 * What genuinely was never surfaced before this slice: a transfer that is
 * literally in flight right now (a real `pending_external` ActionRun) only
 * ever showed up as generic "partially covered" coverage math - never as
 * the real "settlement_confirming" state. And two separate in-flight
 * transfers for the same obligation is a real, detectable inconsistency
 * (duplicate_submission) worth stopping on, not silently summing.
 */
export function resolveSettlementStateFromCoverage(coverage: CoverageRecord[]): {
  settlementState: CanonicalSettlementState;
  reconciliationIssue?: ReconciliationIssue;
} {
  const pending = coverage.filter((record) => record.status === "pending");
  if (pending.length > 1) {
    return {
      settlementState: "reconciliation_required",
      reconciliationIssue: {
        kind: "duplicate_submission",
        detail: `${pending.length} separate transfers are simultaneously in flight for the same obligation.`,
      },
    };
  }
  if (pending.length === 1) {
    return { settlementState: "confirming" };
  }
  return { settlementState: "not_started" };
}
