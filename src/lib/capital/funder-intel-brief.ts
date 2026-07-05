import { prisma } from "@/lib/db";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { getProgramPeopleCounts } from "@/lib/capital/pool-people-counts";
import { buildPoolPeopleLine, buildSourcedPoolHook } from "@/lib/discover/pool-discover-copy";
import { payeeDisplayLabel } from "@/lib/ledger/labels";

export type FunderIntelTier = "snapshot" | "analyst" | "deep";

export type FunderIntelBrief = {
  tier: FunderIntelTier;
  tierLabel: string;
  programId: string;
  programName: string;
  communitySlug: string;
  stakeUsd: number;
  subject: string;
  headline: string;
  poolFacts: string[];
  peopleLine: string;
  sourcedHook: string;
  topContributors: Array<{ label: string; amountUsd: number; status: string }>;
  evidenceLinks: Array<{ label: string; href: string }>;
  checkpointLine: string | null;
};

export function funderIntelTierForStake(amountUsd: number): FunderIntelTier {
  if (amountUsd >= 100) return "deep";
  if (amountUsd >= 25) return "analyst";
  return "snapshot";
}

export function funderIntelTierLabel(tier: FunderIntelTier): string {
  if (tier === "deep") return "Deep brief";
  if (tier === "analyst") return "Analyst brief";
  return "Pool snapshot";
}

/** Evidence-backed funder brief — tier depth scales with stake USD. */
export async function buildFunderIntelBrief(input: {
  programId: string;
  userId: string;
  stakeUsd: number;
}): Promise<FunderIntelBrief | null> {
  const program = await prisma.resolveProgram.findUnique({
    where: { id: input.programId },
    select: {
      id: true,
      name: true,
      missionId: true,
      templateId: true,
      install: { select: { communitySlug: true } },
    },
  });
  if (!program) return null;

  const slug = program.install?.communitySlug ?? "react";
  const pool = await getProgramPoolState(program.id, input.userId);
  if (!pool) return null;

  const tier = funderIntelTierForStake(input.stakeUsd);
  const tierLabel = funderIntelTierLabel(tier);

  const topLimit = tier === "deep" ? 8 : tier === "analyst" ? 5 : 3;
  const topRows = program.missionId
    ? await prisma.paymentAuthorization.findMany({
        where: {
          missionId: program.missionId,
          status: { in: ["authorized", "pending_funding", "claimable"] },
        },
        orderBy: { amountUsd: "desc" },
        take: topLimit,
        select: {
          payeeKeyType: true,
          payeeKey: true,
          amountUsd: true,
          status: true,
        },
      })
    : [];

  const byPayee = new Map<string, { label: string; amountUsd: number; status: string }>();
  for (const row of topRows) {
    const key = `${row.payeeKeyType}:${row.payeeKey}`;
    const existing = byPayee.get(key);
    if (existing) {
      existing.amountUsd = Math.round((existing.amountUsd + row.amountUsd) * 100) / 100;
    } else {
      byPayee.set(key, {
        label: payeeDisplayLabel(row.payeeKeyType, row.payeeKey),
        amountUsd: row.amountUsd,
        status: row.status,
      });
    }
  }
  const topContributors = [...byPayee.values()].slice(0, topLimit);

  const people = await getProgramPeopleCounts(
    program.id,
    program.missionId,
    program.templateId,
  );

  const poolFacts = [
    `Pool balance: $${pool.poolBalanceUsd.toFixed(2)} USDC`,
    `Owed to creators: $${pool.owedToCreatorsUsd.toFixed(2)}`,
    `Your stake: $${input.stakeUsd.toFixed(2)} (${pool.funder.yourSharePct.toFixed(1)}% of pool)`,
    `Settled on Arc: $${pool.settledUsd.toFixed(2)} · Claimable: $${pool.claimableUsd.toFixed(2)}`,
  ];

  if (tier !== "snapshot") {
    poolFacts.push(`Authorizations in queue: ${pool.authorizationCount}`);
  }
  if (tier === "deep") {
    poolFacts.push(`Funders in pool: ${pool.funderCount}`);
  }

  const checkpointLine =
    pool.nextCheckpointUsd != null
      ? `Next checkpoint: $${pool.nextCheckpointUsd.toFixed(0)} (${pool.progressToNextPct}% funded)`
      : null;

  const programUrl = `/communities/${slug}?intent=fund&program=${encodeURIComponent(program.id)}`;
  const evidenceLinks = [
    { label: "Program pool & rules", href: programUrl },
    { label: "Your Capital activity", href: "/capital" },
  ];
  if (tier !== "snapshot") {
    evidenceLinks.push({ label: "Discover funding board", href: "/discover#opportunities" });
  }

  const sourcedHook = buildSourcedPoolHook({
    ...pool,
    contributorCount: people.contributorCount,
  });

  return {
    tier,
    tierLabel,
    programId: program.id,
    programName: pool.programName,
    communitySlug: slug,
    stakeUsd: input.stakeUsd,
    subject: `${tierLabel} · $${input.stakeUsd.toFixed(0)} in ${pool.programName}`,
    headline: `You funded $${input.stakeUsd.toFixed(2)} — here's what the ledger shows`,
    poolFacts,
    peopleLine: buildPoolPeopleLine({
      contributorCount: people.contributorCount,
      funderCount: pool.funderCount,
      payeeCategory: people.payeeCategory,
    }),
    sourcedHook,
    topContributors,
    checkpointLine,
    evidenceLinks,
  };
}
