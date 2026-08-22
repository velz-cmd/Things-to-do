/**
 * Impact signals for Discover.
 *
 * PRODUCT RULE THIS MODULE ENFORCES
 * ---------------------------------
 * A merge is source evidence, not economic value. Activity counts (merged
 * PRs, commits, lines changed, issues closed) prove that something
 * happened; they do not prove anyone benefited. This module therefore
 * refuses to turn activity into an impact claim, and refuses to invent
 * reach that no connector actually observed.
 *
 * Three hard rules, enforced by construction and covered by tests:
 *
 * 1. EVERY quantitative signal carries its own `source` and `observedAt`.
 *    There is no way to build a signal without stating where the number
 *    came from and when it was seen.
 *
 * 2. EVERY signal declares its `scope` — what the number actually
 *    measures. A Libraries.io dependent-repository count is a property of
 *    the REPOSITORY, not proof that one specific pull request benefited
 *    those dependents. Rendering must use the scope-appropriate phrasing
 *    from `describeSignal()` so a repository-level number is never
 *    presented as work-item-level benefit.
 *
 * 3. Popularity is NOT adoption. Stars, forks, and follower counts are
 *    deliberately excluded — they measure attention, not use or benefit.
 *    `POPULARITY_FIELDS` documents this and the test suite asserts none of
 *    them can become an impact signal.
 *
 * When nothing authoritative is available the correct answer is
 * `{ measurable: false, reason }` — "impact is not yet measurable" — never
 * a merge count standing in for impact, and never a synthesized score.
 */

/** What a signal's number is actually a property of. */
export type ImpactSignalScope =
  /** A property of the repository/package the work landed in. */
  | "repository"
  /** A property of a released artifact (a version, a dataset, a track). */
  | "artifact"
  /** A property of this specific unit of work. */
  | "work_item";

/**
 * What kind of claim this signal actually is, so funding logic and UI can
 * never accidentally treat a heuristic as authoritative economic truth:
 *
 * - "observed": a connector directly read this value from an external
 *   source (a GitHub release, a Crossref citation count, a verified
 *   ListenBrainz listen). Every ImpactSignal built today is this kind.
 * - "derived": computed deterministically from one or more observations
 *   plus policy (a funding match, a checkpoint threshold reached). Not an
 *   ImpactSignal itself - this lives on EconomicMatch - but named here so
 *   the same four-way vocabulary is used everywhere in Discover.
 * - "heuristic": a model/AI-produced estimate with no authoritative
 *   source. Must never be presented as impact or money.
 * - "economic": a confirmed on-chain/ledger settlement event. Lives on
 *   settlement/receipt records, not on ImpactSignal.
 */
export type ObservationClassification =
  | "observed"
  | "derived"
  | "heuristic"
  | "economic";

export type ImpactSignal = {
  /** Stable key, unique within a profile. */
  id: string;
  /** Human-readable name, e.g. "Dependent repositories". */
  label: string;
  /** Preformatted display value, e.g. "1,284". */
  value: string;
  scope: ImpactSignalScope;
  /** Authoritative origin, e.g. "Libraries.io". Required — no anonymous numbers. */
  source: string;
  /** Where a human can check the number themselves, when linkable. */
  sourceUrl?: string;
  /** ISO timestamp of the observation this value came from. */
  observedAt: string;
  /**
   * Always "observed" for an ImpactSignal - see ObservationClassification.
   * A signal that isn't a direct external observation doesn't belong in
   * ImpactSignal at all; it belongs in EconomicMatch (derived) or must be
   * excluded entirely (heuristic). Defaults to "observed" so every existing
   * caller of impactSignal()/buildImpactProfile() keeps working unchanged.
   */
  classification: ObservationClassification;
};

export type ImpactProfile =
  | { measurable: true; signals: ImpactSignal[] }
  | { measurable: false; reason: string };

/**
 * Fields that look like impact but are not. Kept as a named list so the
 * exclusion is a documented product decision rather than an oversight, and
 * so tests can assert none of them leak in as signals.
 *
 * Stars/forks/watchers measure attention. Merge and commit counts measure
 * activity. Neither establishes that a change is used or that anyone
 * benefited, which is the only thing that justifies moving money.
 */
export const POPULARITY_FIELDS = [
  "stars",
  "stargazers_count",
  "forks",
  "forks_count",
  "watchers",
  "followers",
  "mergedPrCount",
  "commitCount",
  "linesChanged",
] as const;

const NON_IMPACT = new Set<string>(POPULARITY_FIELDS);

/** True when a field name is attention/activity rather than adoption/benefit. */
export function isPopularityField(field: string): boolean {
  return NON_IMPACT.has(field);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Builds a signal, or returns null when the input is not authoritative.
 * Returning null (rather than a zero/placeholder signal) is what keeps
 * "unknown" distinct from "measured zero".
 */
export function impactSignal(input: {
  id: string;
  label: string;
  count?: number | null;
  scope: ImpactSignalScope;
  source: string;
  sourceUrl?: string;
  observedAt?: string | null;
}): ImpactSignal | null {
  if (isPopularityField(input.id)) return null;
  if (input.count == null || !Number.isFinite(input.count) || input.count <= 0) {
    return null;
  }
  if (!input.source.trim()) return null;
  // An observation with no timestamp cannot be aged or trusted.
  if (!input.observedAt) return null;
  return {
    id: input.id,
    label: input.label,
    value: formatCount(input.count),
    scope: input.scope,
    source: input.source,
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    classification: "observed",
  };
}

/**
 * Scope-accurate sentence for a signal. This is the guard that stops a
 * repository-level number from reading as "this change helped N projects".
 */
export function describeSignal(signal: ImpactSignal): string {
  switch (signal.scope) {
    case "repository":
      return `${signal.value} ${signal.label.toLowerCase()} depend on this repository (source: ${signal.source}). This measures the repository, not this change specifically.`;
    case "artifact":
      return `${signal.value} ${signal.label.toLowerCase()} recorded for this released artifact (source: ${signal.source}).`;
    case "work_item":
      return `${signal.value} ${signal.label.toLowerCase()} attributed to this work (source: ${signal.source}).`;
  }
}

export function impactNotMeasurable(reason: string): ImpactProfile {
  return { measurable: false, reason };
}

/**
 * Assembles a profile from candidate signals. If no candidate survived
 * provenance checks, the profile is explicitly not measurable rather than
 * an empty-but-"measurable" shell that a UI might render as "0 impact".
 */
export function buildImpactProfile(
  candidates: Array<ImpactSignal | null>,
  fallbackReason: string,
): ImpactProfile {
  const signals = candidates.filter((s): s is ImpactSignal => s !== null);
  if (!signals.length) return impactNotMeasurable(fallbackReason);
  return { measurable: true, signals };
}

/**
 * The honest default for a GitHub accepted-work record.
 *
 * `dependentRepoCount` comes from Libraries.io and is repository-scoped, so
 * it is emitted with scope "repository" and never as per-change benefit.
 * When no connector has produced an adoption observation, the result is
 * "not yet measurable" — deliberately NOT the repository's star count and
 * NOT the number of merged pull requests.
 */
export function githubWorkImpactProfile(input: {
  repositoryFullName: string;
  adoption?: {
    dependentRepoCount?: number | null;
    source?: string;
    observedAt?: string | null;
  } | null;
  /**
   * Durably persisted (see FundingOpportunity.security /
   * discover-repository-snapshot) - never re-fetched per request. Naming
   * matches the connector's own honesty discipline: this counts advisories
   * for which GitHub's database defines a patched version, NOT advisories
   * this repository has confirmed adopting.
   */
  security?: {
    advisoriesWithPublishedFix?: Array<{ htmlUrl: string }> | null;
    observedAt?: string | null;
  } | null;
}): ImpactProfile {
  const adoption = input.adoption;
  const security = input.security;
  const advisoryCount = security?.advisoriesWithPublishedFix?.length ?? 0;

  return buildImpactProfile(
    [
      impactSignal({
        id: "dependent_repositories",
        label: "Dependent repositories",
        count: adoption?.dependentRepoCount,
        scope: "repository",
        source: adoption?.source ?? "Libraries.io",
        sourceUrl: `https://libraries.io/github/${input.repositoryFullName}`,
        observedAt: adoption?.observedAt,
      }),
      impactSignal({
        id: "advisories_with_published_fix",
        label: "Patched versions available for advisories",
        count: advisoryCount,
        scope: "repository",
        source: "GitHub Security Advisories",
        sourceUrl:
          advisoryCount === 1
            ? security!.advisoriesWithPublishedFix![0].htmlUrl
            : `https://github.com/${input.repositoryFullName}/security/advisories`,
        observedAt: security?.observedAt,
      }),
    ],
    "No connector has produced an adoption or outcome observation for this work yet, so its impact is not yet measurable.",
  );
}
