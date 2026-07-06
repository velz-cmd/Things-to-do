import { prisma } from "@/lib/db";

const ACTIVE_STAKE_STATUSES = ["active", "target_met", "pending_arc"] as const;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export type CommunityStakeAggregate = {
  programIds: string[];
  stakes: Array<{
    userId: string;
    programId: string;
    principalUsd: number;
    releasedUsd: number;
    status: string;
  }>;
  totalDepositedUsd: number;
  releasedUsd: number;
  availableUsd: number;
  funderCount: number;
  canonicalProgramId: string | null;
};

/** Sum every funder stake in a community — one communal pool truth. */
export async function aggregateCommunityStakes(
  communitySlug: string,
): Promise<CommunityStakeAggregate> {
  const stakes = await prisma.communityFundStake.findMany({
    where: {
      status: { in: [...ACTIVE_STAKE_STATUSES] },
      program: {
        install: { communitySlug },
      },
    },
    select: {
      userId: true,
      programId: true,
      principalUsd: true,
      releasedUsd: true,
      status: true,
    },
  });

  const programIds = [...new Set(stakes.map((s) => s.programId))];
  const totalDepositedUsd = round(stakes.reduce((s, x) => s + x.principalUsd, 0));
  const releasedUsd = round(stakes.reduce((s, x) => s + x.releasedUsd, 0));
  const availableUsd = round(Math.max(0, totalDepositedUsd - releasedUsd));
  const funderCount = new Set(stakes.map((s) => s.userId)).size;

  const principalByProgram = new Map<string, number>();
  for (const stake of stakes) {
    principalByProgram.set(
      stake.programId,
      (principalByProgram.get(stake.programId) ?? 0) + stake.principalUsd,
    );
  }

  let canonicalProgramId: string | null = null;
  let bestPrincipal = -1;
  for (const [programId, principal] of principalByProgram) {
    if (principal > bestPrincipal) {
      bestPrincipal = principal;
      canonicalProgramId = programId;
    }
  }

  if (!canonicalProgramId) {
    const fallback = await prisma.resolveProgram.findFirst({
      where: {
        status: { in: ["active", "deployed"] },
        install: { communitySlug },
      },
      orderBy: [{ budgetUsd: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
    });
    canonicalProgramId = fallback?.id ?? null;
  }

  return {
    programIds,
    stakes,
    totalDepositedUsd,
    releasedUsd,
    availableUsd,
    funderCount,
    canonicalProgramId,
  };
}
