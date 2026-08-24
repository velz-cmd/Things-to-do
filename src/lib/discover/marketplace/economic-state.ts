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
};

export type CanonicalObligation = {
  amountUsd: number | null;
  purpose: string;
  mechanism: FundingMechanism | null;
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
 */
export function resolveCanonicalEconomicStateFromMatch(input: {
  match: EconomicMatch;
  requiredUsd?: number | null;
  payout: CanonicalPayoutState;
  settlementState?: CanonicalSettlementState;
}): CanonicalEconomicState {
  const { match } = input;
  const requiredUsd = input.requiredUsd ?? null;
  const settlementState = input.settlementState ?? "not_started";
  const coverage = computeCanonicalCoverage(match.coverage, requiredUsd);
  const hasAnyIntent = match.eligible.length + match.excluded.length > 0;
  const mechanism = match.recommended;
  const obligation: CanonicalObligation | null =
    mechanism != null
      ? {
          amountUsd: requiredUsd,
          purpose: match.overlapReason,
          mechanism,
        }
      : null;

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

/**
 * Release Slice 3: customer-language mapping (Phase 5 section 21).
 * Internal state names stay internal; this is the one place every UI
 * consumer gets its plain-language sentence, so wording changes happen in
 * one place instead of being copy-pasted and drifting per component.
 * Includes real amounts when known - "60 USDC remaining" is more useful
 * than the generic "Partially funded" whenever a number exists.
 */
export function canonicalStateLabel(state: CanonicalEconomicState): string {
  const { coverage } = state;
  switch (state.state) {
    case "no_demand":
      return "No current funding demand";
    case "demand_found":
      return "Funding intent exists, not yet available";
    case "possible_match":
      return "Possible funding match - identity needs review";
    case "eligible":
      return "Eligible for funding";
    case "funding_available":
      return "Funding available";
    case "authorization_required":
      return "Needs funder review before payment";
    case "payout_setup_required":
      return "Payout setup needed";
    case "partially_covered":
      return coverage.remainingUsd != null
        ? `${coverage.remainingUsd.toFixed(2)} USDC remaining`
        : "Partially funded";
    case "fully_covered":
      return coverage.confirmedUsd > 0
        ? `${coverage.confirmedUsd.toFixed(2)} USDC confirmed`
        : "Fully covered";
    case "settlement_submitted":
      return "Payment submitted";
    case "settlement_confirming":
      return "Payment confirming";
    case "settlement_confirmed":
      return "Payment confirmed";
    case "reconciliation_required":
      return "Payment needs reconciliation";
    case "blocked":
      return "No current funding match";
  }
}
