import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import type { CommunityStakeAggregate } from "@/lib/capital/community-pool-aggregate";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function viewerStakeTotals(
  stakes: CommunityStakeAggregate["stakes"],
  viewerUserId?: string | null,
) {
  let yourDepositUsd = 0;
  let yourReleasedUsd = 0;
  if (viewerUserId) {
    for (const stake of stakes) {
      if (stake.userId === viewerUserId) {
        yourDepositUsd += stake.principalUsd;
        yourReleasedUsd += stake.releasedUsd;
      }
    }
  }
  yourDepositUsd = round(yourDepositUsd);
  yourReleasedUsd = round(yourReleasedUsd);
  return { yourDepositUsd, yourReleasedUsd };
}

export function applyCommunalTotals(
  base: ProgramPoolState,
  aggregate: CommunityStakeAggregate,
  viewerUserId?: string | null,
): ProgramPoolState {
  const { yourDepositUsd, yourReleasedUsd } = viewerStakeTotals(
    aggregate.stakes,
    viewerUserId,
  );
  const totalDepositedUsd = aggregate.totalDepositedUsd;
  const yourSharePct =
    totalDepositedUsd > 0 ? round((yourDepositUsd / totalDepositedUsd) * 100) : 0;
  const estimatedShareOfOwedUsd =
    totalDepositedUsd > 0 && yourDepositUsd > 0
      ? round((yourDepositUsd / totalDepositedUsd) * base.owedToCreatorsUsd)
      : 0;

  return {
    ...base,
    poolBalanceUsd: totalDepositedUsd,
    totalDepositedUsd,
    releasedUsd: aggregate.releasedUsd,
    availableUsd: aggregate.availableUsd,
    funderCount: aggregate.funderCount,
    funder: {
      ...base.funder,
      yourDepositUsd,
      yourSharePct,
      yourReleasedUsd,
      estimatedShareOfOwedUsd,
    },
  };
}
