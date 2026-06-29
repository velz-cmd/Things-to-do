/** RFB #6 — Quadratic funding math (Gitcoin-style √(per-contributor) scores). */

export const DEFAULT_QF_EXPONENT = 0.5;
export const DEFAULT_MATCH_LEVERAGE_TARGET = 2;

export type QfContribution = {
  projectKey: string;
  contributorKey: string;
  amountUsd: number;
};

export type QfAllocation = {
  projectKey: string;
  score: number;
  share: number;
  matchUsd: number;
};

export type QfRoundSummary = {
  totalContributionsUsd: number;
  matchPoolUsd: number;
  matchDistributedUsd: number;
  matchLeverage: number;
  targetMet: boolean;
  uniqueContributors: number;
  projectCount: number;
  allocations: QfAllocation[];
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Per-project QF score = Σ contributor^exponent (default √amount per donor). */
export function computeQfScores(
  contributions: QfContribution[],
  exponent = DEFAULT_QF_EXPONENT,
): Map<string, number> {
  const byProject = new Map<string, Map<string, number>>();

  for (const c of contributions) {
    if (c.amountUsd <= 0) continue;
    if (!byProject.has(c.projectKey)) byProject.set(c.projectKey, new Map());
    const donors = byProject.get(c.projectKey)!;
    donors.set(c.contributorKey, (donors.get(c.contributorKey) ?? 0) + c.amountUsd);
  }

  const scores = new Map<string, number>();
  for (const [project, donors] of byProject) {
    let score = 0;
    for (const amount of donors.values()) {
      score += Math.pow(amount, exponent);
    }
    if (score > 0) scores.set(project, round(score));
  }
  return scores;
}

/** Allocate match pool proportionally to QF scores. */
export function allocateMatchPool(
  scores: Map<string, number>,
  matchPoolUsd: number,
): QfAllocation[] {
  const totalScore = [...scores.values()].reduce((s, v) => s + v, 0);
  if (totalScore < 0.0001 || matchPoolUsd < 0.01) return [];

  const allocations: QfAllocation[] = [];
  let allocated = 0;

  const entries = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < entries.length; i++) {
    const [projectKey, score] = entries[i]!;
    const share = score / totalScore;
    const isLast = i === entries.length - 1;
    const matchUsd = isLast ?
      round(matchPoolUsd - allocated)
    : round(matchPoolUsd * share);
    allocated += matchUsd;
    allocations.push({ projectKey, score, share: round(share * 1000) / 1000, matchUsd });
  }

  return allocations;
}

/**
 * Match leverage for funders — honest doctrine metric.
 * (community contributions + match paid out) / match pool principal.
 * Target 2× = every $1 in match pool unlocked $2+ in verified community value.
 */
export function computeMatchLeverage(input: {
  communityContributionsUsd: number;
  matchDistributedUsd: number;
  matchPoolFundedUsd: number;
  targetMultiplier?: number;
}): { leverage: number; targetMet: boolean; targetMultiplier: number } {
  const target = input.targetMultiplier ?? DEFAULT_MATCH_LEVERAGE_TARGET;
  if (input.matchPoolFundedUsd < 0.01) {
    return { leverage: 0, targetMet: false, targetMultiplier: target };
  }
  const leverage = round(
    (input.communityContributionsUsd + input.matchDistributedUsd) / input.matchPoolFundedUsd,
  );
  return { leverage, targetMet: leverage >= target, targetMultiplier: target };
}

export function contributionsFromAuthorizations(
  rows: Array<{
    payeeKey: string;
    amountUsd: number;
    evidenceJson?: string | null;
  }>,
): QfContribution[] {
  const out: QfContribution[] = [];
  for (const row of rows) {
    let contributorKey = "anonymous";
    if (row.evidenceJson) {
      try {
        const ev = JSON.parse(row.evidenceJson) as { raw?: { contributorSlug?: string } };
        if (ev.raw?.contributorSlug) contributorKey = ev.raw.contributorSlug;
      } catch {
        /* ignore */
      }
    }
    out.push({
      projectKey: row.payeeKey,
      contributorKey,
      amountUsd: row.amountUsd,
    });
  }
  return out;
}
