import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";

export type PoolPeopleCounts = {
  contributorCount: number;
  funderCount: number;
  payeeCategory: string;
};

/** Plain-language people line — counts from ledger, not estimates. */
export function buildPoolPeopleLine(counts: PoolPeopleCounts): string {
  const { contributorCount, funderCount, payeeCategory } = counts;
  const parts: string[] = [];
  if (contributorCount > 0) {
    parts.push(
      `${contributorCount} ${contributorCount === 1 ? payeeCategory.slice(0, -1) || "contributor" : payeeCategory}`,
    );
  }
  if (funderCount > 0) {
    parts.push(`${funderCount} funder${funderCount === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join(" · ") : "No ledger contributors yet";
}

/** One sourced hook from real pool + obligation numbers — no marketing fluff. */
export function buildSourcedPoolHook(
  pool: Pick<
    ProgramPoolState,
    | "programName"
    | "poolBalanceUsd"
    | "owedToCreatorsUsd"
    | "claimableUsd"
    | "nextCheckpointUsd"
    | "progressToNextPct"
    | "payeeCategory"
    | "funderCount"
  > & { contributorCount: number },
): string {
  const poolUsd = pool.poolBalanceUsd;
  const owed = pool.owedToCreatorsUsd;

  if (poolUsd >= 0.01 && owed >= 0.01) {
    const pctFunded = Math.min(100, Math.round((poolUsd / owed) * 100));
    return `$${poolUsd.toFixed(0)} pool covers ${pctFunded}% of $${owed.toFixed(0)} owed · ${pool.contributorCount} ${pool.payeeCategory} in queue`;
  }

  if (poolUsd >= 0.01 && pool.nextCheckpointUsd != null) {
    return `$${poolUsd.toFixed(0)} in pool · ${pool.progressToNextPct}% toward $${pool.nextCheckpointUsd.toFixed(0)} checkpoint · ${pool.funderCount} funder${pool.funderCount === 1 ? "" : "s"}`;
  }

  if (poolUsd >= 0.01) {
    return `$${poolUsd.toFixed(2)} funded · ${pool.contributorCount} verified ${pool.payeeCategory} · ${pool.programName}`;
  }

  if (owed >= 0.01) {
    return `$${owed.toFixed(0)} owed to ${pool.contributorCount || "verified"} ${pool.payeeCategory} — pool empty, fulfill to unlock payouts`;
  }

  if (pool.claimableUsd >= 0.01) {
    return `$${pool.claimableUsd.toFixed(0)} ready for creators to claim`;
  }

  return `${pool.programName} · connect sensors to record authorizations`;
}

export function buildLiveFundHeadline(input: {
  programName: string;
  amountUsd: number;
  poolBalanceUsd: number;
  contributorCount: number;
  funderCount: number;
  payeeCategory: string;
  sourcedHook: string;
}): string {
  return `$${input.amountUsd.toFixed(0)} added · pool now $${input.poolBalanceUsd.toFixed(0)} · ${buildPoolPeopleLine({
    contributorCount: input.contributorCount,
    funderCount: input.funderCount,
    payeeCategory: input.payeeCategory,
  })}`;
}

export function buildLiveFundSubline(sourcedHook: string): string {
  return sourcedHook.length > 120 ? `${sourcedHook.slice(0, 117)}…` : sourcedHook;
}
