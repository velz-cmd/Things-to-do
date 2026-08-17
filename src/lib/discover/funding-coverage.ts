import type {
  GitHubFundingActivityRecord,
  GitHubWorkCategory,
} from "@/lib/github/types";

export type FundingCoverageState = "covered" | "uncovered" | "no_activity";
export type ContributorReadiness =
  | "ready"
  | "attribution_blocked"
  | "identity_blocked"
  | "payout_blocked"
  | "not_evaluated";
export type FundingAmountState =
  | "no_amount"
  | "modelled_estimate"
  | "policy_calculated"
  | "verified_obligation"
  | "funding_reserved"
  | "claimable"
  | "submitted"
  | "partially_confirmed"
  | "confirmed"
  | "failed"
  | "reconciled";
export type FundingSettlementState =
  | "none"
  | "authorised"
  | "submitted"
  | "partially_confirmed"
  | "confirmed"
  | "failed"
  | "reconciled";
export type WorkLedgerFilter =
  | "all"
  | "needs_action"
  | "ready"
  | "in_progress"
  | "paid";

export type FundingCoverageAction = {
  id:
    | "discover.capture_repository_snapshot"
    | "discover.start_mission"
    | "discover.open_evidence"
    | "discover.resolve_identity"
    | "discover.open_program"
    | "profile.connect_source"
    | "capital.open_funding"
    | "capital.authorize_settlement"
    | "receipt.open";
  label: string;
  reason: string;
  href: string | null;
  recordCount: number | null;
};

export type FundingCoverageLedgerRecord = {
  id: string;
  repository: string;
  workType: string;
  category: GitHubWorkCategory;
  title: string;
  contributor: string;
  acceptedAt: string;
  sourceUrl: string;
  evidenceState: "verified" | "snapshot_only" | "unavailable";
  evidenceId: string;
  policyState: "covered" | "uncovered";
  policyReason: string;
  policyVersion: number | null;
  identityState: ContributorReadiness;
  amountState: FundingAmountState;
  amountUsd: number | null;
  poolState: "available" | "shortfall" | "not_attached" | "unavailable";
  poolName: string | null;
  blocker: string;
  nextAction: FundingCoverageAction;
  filter: WorkLedgerFilter;
  freshness: string;
  timeline: Array<{ at: string; label: string }>;
};

export type FundingCoverageMatrixRow = {
  category: GitHubWorkCategory;
  label: string;
  accepted: number;
  covered: number;
  uncovered: number;
  attributionBlocked: number | null;
  payoutBlocked: number | null;
  obligations: number | null;
  ready: number | null;
  submitted: number | null;
  confirmed: number | null;
};

export type FundingCoverageCommandCentre = {
  context: {
    community: string | null;
    repository: string | null;
    sourceType: "persisted_github_evidence" | "repository_snapshot" | "unavailable";
    sourceLabel: string;
    evaluationStart: string | null;
    evaluationEnd: string | null;
    latestVerifiedEventAt: string | null;
    freshness: "current" | "stale" | "unavailable";
    baseline: boolean;
  };
  pulse: Array<{
    id: string;
    label: string;
    value: number | null;
    unit: string;
    filter: WorkLedgerFilter;
    unavailableReason: string | null;
  }>;
  nextAction: FundingCoverageAction | null;
  summary: string;
  matrix: FundingCoverageMatrixRow[];
  ledger: FundingCoverageLedgerRecord[];
};

type CoverageInput = {
  category: GitHubWorkCategory;
  label: string;
  activityCount: number;
  status: FundingCoverageState;
  programIds: string[];
  programNames: string[];
  mechanism: string;
};

type ProgramInput = {
  id: string;
  name: string;
  categories: GitHubWorkCategory[];
  policyVersion: number | null;
};

type PoolInput = {
  programId: string;
  programName: string;
  programHref: string;
  fundingHref: string;
  availableUsd: number;
  recognizedOwedUsd: number;
  authorizationCount: number;
  contributorCount: number;
};

export type FundingCoverageCommandInput = {
  selected: null | {
    fullName: string;
    communitySlug: string;
    snapshotPersisted: boolean;
    observedAt: string;
    stale: boolean;
  };
  coverage: CoverageInput[];
  activity: GitHubFundingActivityRecord[];
  programs: ProgramInput[];
  pools: PoolInput[];
  outcomes: Array<{
    publicReference: string;
    payeeCount: number;
    issuedAt: string;
  }>;
  proof: {
    persistedEvents: number;
    verificationState: "persisted" | "snapshot_only" | "empty";
    observedAt: string | null;
  };
  funding: {
    shortfallUsd: number;
    blockedRecipients: number;
    eligibleRecipients: number;
    obligationCount: number;
  };
  blockers: Array<{ code: string; count: number; recoveryHref: string }>;
  changes: {
    kind: "empty" | "baseline" | "comparison";
  };
  settlement: {
    authorised: number;
    submitted: number;
    partiallyConfirmed: number;
    confirmed: number;
    reconciliationRequired: number;
  };
  degradedSources: string[];
};

export function deriveCoverageState(input: {
  accepted: boolean;
  matchingPolicy: boolean;
}): FundingCoverageState {
  if (!input.accepted) return "no_activity";
  return input.matchingPolicy ? "covered" : "uncovered";
}

export function deriveContributorReadiness(input: {
  attributionResolved: boolean | null;
  identityVerified: boolean | null;
  payoutReady: boolean | null;
}): ContributorReadiness {
  if (input.attributionResolved === null) return "not_evaluated";
  if (!input.attributionResolved) return "attribution_blocked";
  if (input.identityVerified === null || input.payoutReady === null) return "not_evaluated";
  if (!input.identityVerified) return "identity_blocked";
  if (!input.payoutReady) return "payout_blocked";
  return "ready";
}

export function deriveAmountState(input: {
  obligationUsd: number | null;
  reservedUsd?: number;
  claimableUsd?: number;
  settlementState: FundingSettlementState;
}): FundingAmountState {
  if (input.settlementState === "reconciled") return "reconciled";
  if (input.settlementState === "failed") return "failed";
  if (input.settlementState === "confirmed") return "confirmed";
  if (input.settlementState === "partially_confirmed") return "partially_confirmed";
  if (input.settlementState === "submitted") return "submitted";
  if ((input.claimableUsd ?? 0) > 0) return "claimable";
  if ((input.reservedUsd ?? 0) > 0) return "funding_reserved";
  if (input.obligationUsd !== null) return "verified_obligation";
  return "no_amount";
}

export function derivePoolReadiness(input: {
  poolExists: boolean;
  availableUsd: number | null;
  requiredUsd: number | null;
  checkpointSatisfied: boolean | null;
}): "ready" | "shortfall" | "checkpoint_blocked" | "not_attached" | "unavailable" {
  if (!input.poolExists) return "not_attached";
  if (input.availableUsd === null || input.requiredUsd === null) return "unavailable";
  if (input.availableUsd < input.requiredUsd) return "shortfall";
  if (input.checkpointSatisfied === false) return "checkpoint_blocked";
  return "ready";
}

export function deriveSettlementState(input: {
  status: string | null;
  confirmedAt?: string | null;
}): FundingSettlementState {
  const status = input.status?.toLowerCase() ?? "";
  if (input.confirmedAt || status === "confirmed") return "confirmed";
  if (status.includes("partial")) return "partially_confirmed";
  if (status === "failed") return "failed";
  if (status === "reconciled") return "reconciled";
  if (["submitted", "pending_confirmation", "pending_external"].includes(status)) return "submitted";
  if (["authorised", "authorized", "prepared", "approved"].includes(status)) return "authorised";
  return "none";
}

export function summarizeSettlementStates(
  rows: Array<{ status: string | null; confirmedAt?: string | null }>,
) {
  return rows.reduce(
    (summary, settlement) => {
      const state = deriveSettlementState(settlement);
      if (state === "authorised") summary.authorised += 1;
      if (state === "submitted") summary.submitted += 1;
      if (state === "partially_confirmed") summary.partiallyConfirmed += 1;
      if (state === "confirmed") summary.confirmed += 1;
      if (state === "failed") summary.reconciliationRequired += 1;
      return summary;
    },
    {
      authorised: 0,
      submitted: 0,
      partiallyConfirmed: 0,
      confirmed: 0,
      reconciliationRequired: 0,
    },
  );
}

export function deriveFundingCycleStage(input: {
  coverage: FundingCoverageState;
  contributor: ContributorReadiness;
  amount: FundingAmountState;
  pool: ReturnType<typeof derivePoolReadiness>;
  settlement: FundingSettlementState;
}) {
  if (input.settlement === "confirmed") return "confirmed";
  if (["submitted", "partially_confirmed"].includes(input.settlement)) return "submitted";
  if (input.settlement === "authorised") return "authorised";
  if (input.pool === "ready") return "pool_ready";
  if (input.amount !== "no_amount") return "obligation";
  if (input.contributor === "ready") return "contributor_ready";
  if (input.coverage === "covered") return "policy_covered";
  return "accepted";
}

export function buildCoverageMatrix(coverage: CoverageInput[]): FundingCoverageMatrixRow[] {
  const supported: GitHubWorkCategory[] = ["code", "review", "documentation", "release_work"];
  return supported.map((category) => {
    const row = coverage.find((item) => item.category === category);
    const accepted = row?.activityCount ?? 0;
    return {
      category,
      label: row?.label ?? category,
      accepted,
      covered: row?.status === "covered" ? accepted : 0,
      uncovered: row?.status === "uncovered" ? accepted : 0,
      attributionBlocked: null,
      payoutBlocked: null,
      obligations: null,
      ready: null,
      submitted: null,
      confirmed: null,
    };
  });
}

export function deriveNextAction(input: FundingCoverageCommandInput): FundingCoverageAction | null {
  const githubBlocker = input.blockers.find((item) =>
    ["github_installation_missing", "github_permission_revoked"].includes(item.code));
  if (githubBlocker) {
    return {
      id: "profile.connect_source",
      label: "Reconnect GitHub",
      reason: "The GitHub installation or repository permission needs attention before evaluation can continue.",
      href: `/connect/github?returnTo=${encodeURIComponent(input.selected ? `/discover?repo=${input.selected.fullName}` : "/discover")}`,
      recordCount: githubBlocker.count,
    };
  }
  const selected = input.selected;
  if (!selected) {
    return {
      id: "profile.connect_source",
      label: "Connect GitHub",
      reason: "Connect GitHub and select a repository before RESOLVE can evaluate accepted work.",
      href: `/connect/github?returnTo=${encodeURIComponent("/discover")}`,
      recordCount: null,
    };
  }
  const criticalEvaluationSources = new Set([
    "discover_intelligence",
    "snapshot_history",
    "proof_events",
    "programs",
    "policies",
  ]);
  const evaluationUnavailable = input.degradedSources.some((source) =>
    criticalEvaluationSources.has(source));
  if (
    evaluationUnavailable ||
    selected.stale ||
    input.proof.verificationState === "empty" ||
    !selected.snapshotPersisted
  ) {
    return {
      id: "discover.capture_repository_snapshot",
      label: "Refresh evaluation",
      reason: selected.stale
        ? "The last persisted repository evaluation is stale."
        : evaluationUnavailable
          ? "A required evaluation source is temporarily unavailable."
          : "A persisted repository evaluation is required before evidence can be evaluated.",
      href: null,
      recordCount: null,
    };
  }
  const evidenceBlocker = input.blockers.find((item) =>
    ["evidence_review_required", "evidence_verification_failed"].includes(item.code));
  if (evidenceBlocker) {
    return {
      id: "discover.open_evidence",
      label: "Inspect evidence",
      reason: `${evidenceBlocker.count} accepted ${evidenceBlocker.count === 1 ? "record needs" : "records need"} evidence review before policy evaluation can continue.`,
      href: input.activity[0]?.sourceUrl ?? null,
      recordCount: evidenceBlocker.count,
    };
  }
  const uncovered = input.coverage.reduce(
    (sum, row) => sum + (row.status === "uncovered" ? row.activityCount : 0),
    0,
  );
  if (uncovered > 0) {
    return {
      id: "discover.start_mission",
      label: "Design funding rule",
      reason: `${uncovered} accepted ${uncovered === 1 ? "record is" : "records are"} outside the active funding policy.`,
      href: null,
      recordCount: uncovered,
    };
  }
  const attributionBlocker = input.blockers.find((item) =>
    ["attribution_conflict", "attribution_unresolved"].includes(item.code));
  if (attributionBlocker) {
    return {
      id: "discover.resolve_identity",
      label: "Review attribution",
      reason: `${attributionBlocker.count} accepted ${attributionBlocker.count === 1 ? "record has" : "records have"} unresolved contributor attribution.`,
      href: attributionBlocker.recoveryHref,
      recordCount: attributionBlocker.count,
    };
  }
  if (input.funding.blockedRecipients > 0) {
    const blocker = input.blockers.find((item) =>
      ["identity_unresolved", "payout_destination_unverified"].includes(item.code));
    return {
      id: "discover.resolve_identity",
      label: "Resolve contributor identities",
      reason: `${input.funding.blockedRecipients} covered ${input.funding.blockedRecipients === 1 ? "contributor is" : "contributors are"} missing verified identity or payout readiness.`,
      href: blocker?.recoveryHref ?? `/profile?section=identity&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`,
      recordCount: input.funding.blockedRecipients,
    };
  }
  if (input.funding.shortfallUsd > 0) {
    return {
      id: "capital.open_funding",
      label: "Fund Pool",
      reason: `Verified obligations exceed confirmed available Pool capital by ${input.funding.shortfallUsd.toFixed(2)} USDC.`,
      href: input.pools[0]?.fundingHref ?? `/capital?community=${encodeURIComponent(selected.communitySlug)}`,
      recordCount: input.funding.obligationCount,
    };
  }
  if (input.settlement.authorised > 0) {
    return {
      id: "capital.authorize_settlement",
      label: "Review in Capital",
      reason: `${input.settlement.authorised} authorised ${input.settlement.authorised === 1 ? "settlement needs" : "settlements need"} operator review before submission.`,
      href: `/capital?community=${encodeURIComponent(selected.communitySlug)}&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`,
      recordCount: input.settlement.authorised,
    };
  }
  if (input.settlement.submitted > 0) {
    return {
      id: "capital.open_funding",
      label: "Track settlement",
      reason: `${input.settlement.submitted} submitted ${input.settlement.submitted === 1 ? "settlement is" : "settlements are"} awaiting authoritative confirmation.`,
      href: `/capital?community=${encodeURIComponent(selected.communitySlug)}&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`,
      recordCount: input.settlement.submitted,
    };
  }
  if (input.settlement.reconciliationRequired > 0 || input.settlement.partiallyConfirmed > 0) {
    return {
      id: "capital.open_funding",
      label: "Review reconciliation",
      reason: "A submitted settlement has an unresolved or partial confirmation state.",
      href: `/capital?community=${encodeURIComponent(selected.communitySlug)}&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`,
      recordCount: input.settlement.reconciliationRequired + input.settlement.partiallyConfirmed,
    };
  }
  if (input.outcomes[0]) {
    return {
      id: "receipt.open",
      label: "View confirmed outcome",
      reason: "The latest completed funding cycle has an issued receipt and confirmed transaction.",
      href: `/outcomes/${encodeURIComponent(input.outcomes[0].publicReference)}`,
      recordCount: input.outcomes[0].payeeCount,
    };
  }
  if (input.programs[0]) {
    return {
      id: "discover.open_program",
      label: "Open program",
      reason: "No immediate blocker is recorded. Review the active program before the next evaluation.",
      href: `/programs/${encodeURIComponent(input.programs[0].id)}`,
      recordCount: input.funding.obligationCount,
    };
  }
  return null;
}

export function buildDeterministicSummary(input: FundingCoverageCommandInput) {
  if (!input.selected) return "Select a repository to start a funding coverage evaluation.";
  const accepted = input.coverage.reduce((sum, row) => sum + row.activityCount, 0);
  const covered = input.coverage.reduce(
    (sum, row) => sum + (row.status === "covered" ? row.activityCount : 0),
    0,
  );
  const uncovered = Math.max(0, accepted - covered);
  return `${accepted} accepted ${accepted === 1 ? "record" : "records"} evaluated. ${covered} covered, ${uncovered} uncovered, and ${input.settlement.confirmed} confirmed ${input.settlement.confirmed === 1 ? "settlement" : "settlements"}.`;
}

export function buildFundingCoverageCommandCentre(
  input: FundingCoverageCommandInput,
): FundingCoverageCommandCentre {
  const selected = input.selected;
  const matrix = buildCoverageMatrix(input.coverage);
  const latestActivity = input.activity[0]?.occurredAt ?? input.proof.observedAt;
  const earliestActivity = input.activity.length
    ? input.activity[input.activity.length - 1]!.occurredAt
    : null;
  const coveredCount = input.coverage.reduce(
    (sum, row) => sum + (row.status === "covered" ? row.activityCount : 0),
    0,
  );
  const acceptedCount = input.coverage.reduce((sum, row) => sum + row.activityCount, 0);
  const authorisedCount = input.pools.reduce((sum, pool) => sum + pool.authorizationCount, 0);
  const coverageByCategory = new Map(input.coverage.map((row) => [row.category, row]));
  const programByCategory = new Map<GitHubWorkCategory, ProgramInput>();
  input.programs.forEach((program) => {
    program.categories.forEach((category) => {
      if (!programByCategory.has(category)) programByCategory.set(category, program);
    });
  });
  const poolByProgram = new Map(input.pools.map((pool) => [pool.programId, pool]));
  const evidenceState = input.proof.verificationState === "persisted"
    ? "verified" as const
    : input.proof.verificationState === "snapshot_only"
      ? "snapshot_only" as const
      : "unavailable" as const;

  const ledger = selected
    ? input.activity.map((record): FundingCoverageLedgerRecord => {
        const coverage = coverageByCategory.get(record.category);
        const covered = coverage?.status === "covered";
        const program = programByCategory.get(record.category);
        const pool = program ? poolByProgram.get(program.id) : null;
        const poolState = !pool
          ? "not_attached" as const
          : pool.availableUsd < pool.recognizedOwedUsd
            ? "shortfall" as const
            : "available" as const;
        const nextAction: FundingCoverageAction = !covered
          ? {
              id: "discover.start_mission",
              label: "Design funding rule",
              reason: coverage?.mechanism ?? "No active policy covers this accepted work.",
              href: null,
              recordCount: 1,
            }
          : program
            ? {
                id: "discover.open_program",
                label: "Open program",
                reason: "The accepted work matches an active policy. Inspect the operating program for obligation readiness.",
                href: `/programs/${encodeURIComponent(program.id)}`,
                recordCount: 1,
              }
            : {
                id: "discover.open_evidence",
                label: "View proof",
                reason: "Inspect the persisted evidence before another economic action is prepared.",
                href: `/api/discover/oss-evidence/${encodeURIComponent(record.id)}`,
                recordCount: 1,
              };
        return {
          id: record.id,
          repository: selected.fullName,
          workType: coverage?.label ?? record.sourceKind.replaceAll("_", " "),
          category: record.category,
          title: record.title,
          contributor: record.actor,
          acceptedAt: record.occurredAt,
          sourceUrl: record.sourceUrl,
          evidenceState,
          evidenceId: record.id,
          policyState: covered ? "covered" : "uncovered",
          policyReason: coverage?.mechanism ?? "No policy evaluation is available.",
          policyVersion: program?.policyVersion ?? null,
          identityState: "not_evaluated",
          amountState: "no_amount",
          amountUsd: null,
          poolState,
          poolName: pool?.programName ?? null,
          blocker: !covered
            ? "Active funding rule required"
            : poolState === "shortfall"
              ? "Pool funding is below persisted recognized obligations"
              : "No record-linked obligation is available in the current read model",
          nextAction,
          filter: !covered || poolState === "shortfall" ? "needs_action" : "in_progress",
          freshness: selected.stale ? "Source snapshot is stale" : "Current persisted snapshot",
          timeline: [
            { at: record.occurredAt, label: `${record.sourceKind.replaceAll("_", " ")} accepted on GitHub` },
            ...(input.proof.observedAt
              ? [{ at: input.proof.observedAt, label: "Repository evaluation persisted" }]
              : []),
          ],
        };
      })
    : [];

  return {
    context: {
      community: selected?.communitySlug ?? null,
      repository: selected?.fullName ?? null,
      sourceType: input.proof.verificationState === "persisted"
        ? "persisted_github_evidence"
        : selected?.snapshotPersisted
          ? "repository_snapshot"
          : "unavailable",
      sourceLabel: input.proof.verificationState === "persisted"
        ? "Persisted GitHub evidence"
        : selected?.snapshotPersisted
          ? "Persisted repository snapshot"
          : "GitHub source unavailable",
      evaluationStart: earliestActivity,
      evaluationEnd: selected?.observedAt ?? null,
      latestVerifiedEventAt: latestActivity,
      freshness: !selected ? "unavailable" : selected.stale ? "stale" : "current",
      baseline: input.changes.kind !== "comparison",
    },
    pulse: [
      { id: "accepted", label: "Accepted Work", value: acceptedCount, unit: "records", filter: "all", unavailableReason: null },
      { id: "covered", label: "Covered", value: coveredCount, unit: "records", filter: "in_progress", unavailableReason: null },
      { id: "ready", label: "Ready", value: input.funding.eligibleRecipients, unit: "contributors", filter: "ready", unavailableReason: null },
      {
        id: "in-progress",
        label: "In Progress",
        value: authorisedCount + input.settlement.submitted + input.settlement.partiallyConfirmed,
        unit: "records",
        filter: "in_progress",
        unavailableReason: null,
      },
      { id: "confirmed", label: "Confirmed", value: input.settlement.confirmed, unit: "batches", filter: "paid", unavailableReason: null },
    ],
    nextAction: deriveNextAction(input),
    summary: buildDeterministicSummary(input),
    matrix,
    ledger,
  };
}
