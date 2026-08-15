/**
 * Economic matching — the decision layer between verified impact and real
 * funding intent.
 *
 * The product rule this encodes: RESOLVE does not pay for activity. It
 * finds where a verified outcome intersects capital that has *already
 * declared* an interest in that class of outcome, checks whether the same
 * economic purpose was already settled, and then names the one legitimate
 * mechanism — or explicitly declines to offer any.
 *
 * "No valid mechanism" is a first-class, correct result. A verified item
 * with no funding intent behind it should show evidence and stop, not
 * sprout a Reward button. Section 6 of the product spec: there should
 * often be no payment button.
 *
 * Deterministic by construction. Mechanism eligibility, coverage and
 * overlap are decided by explicit rules over canonical records, never by a
 * model. AI may summarize a result but must not produce one.
 */

/** Where capital can legitimately come from. Mirrors existing backend concepts. */
export type FundingMechanism =
  | "pool_allocation"
  | "sponsor_program"
  | "funded_request"
  | "recurring_support"
  | "direct_support";

/** Declared, already-existing intent to fund a class of outcome. */
export type FundingIntentCandidate = {
  id: string;
  mechanism: FundingMechanism;
  label: string;
  /** Outcome classes this capital is for, e.g. ["security"]. Empty = unrestricted. */
  eligibleClasses: string[];
  /** Capital actually available now, in USD. */
  availableUsd: number;
  /** True only when the backing entity can accept/move money right now. */
  executable: boolean;
  /** Why it cannot execute, when executable is false. */
  blocker?: string;
  /** Set when only a specific person may act (e.g. the Pool operator). */
  requiresRole?: "operator" | "requester" | "funder";
};

/** A prior payment that may already cover this work. */
export type CoverageRecord = {
  id: string;
  mechanism: FundingMechanism;
  amountUsd: number;
  /**
   * What the earlier payment was *for*. Overlap is judged on economic
   * purpose, not on the fact that money was paid. A bounty for delivery and
   * a retroactive grant for sustained adoption are different purposes and
   * may both be legitimate.
   */
  purpose: string;
  /** Canonical obligation this settled, when it settled one. */
  obligationId?: string;
  receiptReference?: string;
};

export type OverlapVerdict =
  | "no_conflict"
  | "possible_overlap"
  | "duplicate_obligation";

export type MechanismMatch = {
  intent: FundingIntentCandidate;
  eligible: boolean;
  /** Plain-language reason, shown to the user either way. */
  reason: string;
};

export type EconomicMatch = {
  /** Mechanisms that could legitimately fund this now. */
  eligible: MechanismMatch[];
  /** Mechanisms considered and ruled out, with reasons. Shown for auditability. */
  excluded: MechanismMatch[];
  overlap: OverlapVerdict;
  overlapReason: string;
  /** Prior payments found for this work, whatever the overlap verdict. */
  coverage: CoverageRecord[];
  /** The single mechanism RESOLVE recommends, or null when none is valid. */
  recommended: FundingMechanism | null;
  /** Why that recommendation, or why there is none. */
  recommendationReason: string;
  /** True when a human must approve before money can move. */
  requiresReview: boolean;
};

/**
 * Mechanism priority when several are eligible. Pooled and sponsor capital
 * is delegated capital with an explicit mandate, so it is preferred over
 * asking an individual to pay voluntarily for the same outcome.
 */
const MECHANISM_PRIORITY: FundingMechanism[] = [
  "funded_request",
  "pool_allocation",
  "sponsor_program",
  "recurring_support",
  "direct_support",
];

function classMatches(intent: FundingIntentCandidate, outcomeClass: string): boolean {
  if (!intent.eligibleClasses.length) return true;
  return intent.eligibleClasses.some(
    (candidate) => candidate.toLowerCase() === outcomeClass.toLowerCase(),
  );
}

/**
 * Classifies prior payments against the work now being considered.
 *
 * - Same obligation already settled -> duplicate_obligation. Never repay.
 * - Same stated purpose -> possible_overlap. A human decides.
 * - Different purpose -> no_conflict. Legitimately fundable again.
 */
export function assessOverlap(input: {
  purpose: string;
  obligationId?: string;
  coverage: CoverageRecord[];
}): { verdict: OverlapVerdict; reason: string } {
  if (!input.coverage.length) {
    return {
      verdict: "no_conflict",
      reason: "No prior payment is recorded for this work.",
    };
  }

  const settledObligation = input.obligationId
    ? input.coverage.find((row) => row.obligationId === input.obligationId)
    : undefined;
  if (settledObligation) {
    return {
      verdict: "duplicate_obligation",
      reason: `This exact obligation was already settled by ${settledObligation.mechanism.replaceAll("_", " ")}${
        settledObligation.receiptReference
          ? ` (receipt ${settledObligation.receiptReference})`
          : ""
      }. Paying again would settle the same obligation twice.`,
    };
  }

  const samePurpose = input.coverage.find(
    (row) => row.purpose.trim().toLowerCase() === input.purpose.trim().toLowerCase(),
  );
  if (samePurpose) {
    return {
      verdict: "possible_overlap",
      reason: `${samePurpose.mechanism.replaceAll("_", " ")} already paid $${samePurpose.amountUsd.toFixed(2)} for "${samePurpose.purpose}". A funder should confirm this new payment has a different economic purpose before it proceeds.`,
    };
  }

  const priorPurposes = input.coverage.map((row) => `"${row.purpose}"`).join(", ");
  return {
    verdict: "no_conflict",
    reason: `Prior payments exist for a different purpose (${priorPurposes}), so this does not duplicate them.`,
  };
}

/**
 * The core matcher. Given one verified outcome and the funding intents that
 * exist, decides what may legitimately fund it and what RESOLVE recommends.
 */
export function matchImpactToCapital(input: {
  /** Outcome class, e.g. "security" | "performance" | "documentation". */
  outcomeClass: string;
  /** What this payment would be for. Used for overlap comparison. */
  purpose: string;
  /** Amount still needed, when known. */
  requiredUsd?: number;
  obligationId?: string;
  /** True only when sourced impact evidence exists for this work. */
  hasSourcedImpact: boolean;
  intents: FundingIntentCandidate[];
  coverage: CoverageRecord[];
  /** Roles the current viewer holds, gating role-restricted mechanisms. */
  viewerRoles?: Array<"operator" | "requester" | "funder">;
}): EconomicMatch {
  const roles = new Set(input.viewerRoles ?? []);
  const eligible: MechanismMatch[] = [];
  const excluded: MechanismMatch[] = [];

  for (const intent of input.intents) {
    if (!classMatches(intent, input.outcomeClass)) {
      excluded.push({
        intent,
        eligible: false,
        reason: `${intent.label} funds ${intent.eligibleClasses.join(", ")}, not ${input.outcomeClass}.`,
      });
      continue;
    }
    if (!intent.executable) {
      excluded.push({
        intent,
        eligible: false,
        reason: intent.blocker ?? `${intent.label} cannot move capital right now.`,
      });
      continue;
    }
    if (intent.requiresRole && !roles.has(intent.requiresRole)) {
      excluded.push({
        intent,
        eligible: false,
        reason: `Only the ${intent.requiresRole} can allocate from ${intent.label}.`,
      });
      continue;
    }
    if (input.requiredUsd != null && intent.availableUsd < input.requiredUsd) {
      excluded.push({
        intent,
        eligible: false,
        reason: `${intent.label} has $${intent.availableUsd.toFixed(2)} available, below the $${input.requiredUsd.toFixed(2)} required.`,
      });
      continue;
    }
    // Delegated capital (pool/sponsor/request) carries a mandate to fund a
    // class of outcome, so it needs evidence that the outcome is real.
    // Direct and recurring support are a person's own voluntary choice and
    // are never gated on measurable impact.
    const needsEvidence =
      intent.mechanism === "pool_allocation" ||
      intent.mechanism === "sponsor_program" ||
      intent.mechanism === "funded_request";
    if (needsEvidence && !input.hasSourcedImpact) {
      excluded.push({
        intent,
        eligible: false,
        reason: `${intent.label} allocates against measured outcomes, and no sourced impact evidence exists for this work yet.`,
      });
      continue;
    }
    eligible.push({
      intent,
      eligible: true,
      reason: `${intent.label} funds ${input.outcomeClass} outcomes and has $${intent.availableUsd.toFixed(2)} available.`,
    });
  }

  const overlap = assessOverlap({
    purpose: input.purpose,
    obligationId: input.obligationId,
    coverage: input.coverage,
  });

  if (overlap.verdict === "duplicate_obligation") {
    return {
      eligible: [],
      excluded: [...excluded, ...eligible.map((m) => ({ ...m, eligible: false, reason: overlap.reason }))],
      overlap: overlap.verdict,
      overlapReason: overlap.reason,
      coverage: input.coverage,
      recommended: null,
      recommendationReason: overlap.reason,
      requiresReview: false,
    };
  }

  if (!eligible.length) {
    return {
      eligible,
      excluded,
      overlap: overlap.verdict,
      overlapReason: overlap.reason,
      coverage: input.coverage,
      recommended: null,
      recommendationReason:
        "No funding intent currently covers this outcome, so RESOLVE is not offering a payment for it.",
      requiresReview: false,
    };
  }

  const ranked = [...eligible].sort(
    (a, b) =>
      MECHANISM_PRIORITY.indexOf(a.intent.mechanism) -
      MECHANISM_PRIORITY.indexOf(b.intent.mechanism),
  );
  const winner = ranked[0]!;
  const requiresReview = overlap.verdict === "possible_overlap";

  return {
    eligible: ranked,
    excluded,
    overlap: overlap.verdict,
    overlapReason: overlap.reason,
    coverage: input.coverage,
    recommended: winner.intent.mechanism,
    recommendationReason: requiresReview
      ? `${winner.intent.label} is eligible, but ${overlap.reason}`
      : `${winner.intent.label} is the most specific delegated capital available for this outcome.`,
    requiresReview,
  };
}
