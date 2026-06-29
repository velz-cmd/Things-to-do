import { prisma } from "@/lib/db";
import type { SettlementInputEvent } from "@/lib/authorization/types";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import {
  allocateMatchPool,
  computeMatchLeverage,
  computeQfScores,
  contributionsFromAuthorizations,
  DEFAULT_MATCH_LEVERAGE_TARGET,
  DEFAULT_QF_EXPONENT,
} from "@/lib/capital/quadratic-funding";
import { getProgramStakePool, refreshProgramYieldCache } from "@/lib/capital/yield-service";
import { sensorProofHash } from "@/lib/sensors/proof";
import type { ProgramRules } from "@/lib/communities/types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Run QF allocation — creates qf.match authorizations from match pool. */
export async function runQfMatchAllocation(input: {
  programId: string;
  missionId: string;
  rules: ProgramRules;
  founderUserId?: string;
}): Promise<{
  ok: boolean;
  allocations: number;
  matchDistributedUsd: number;
  summary: ReturnType<typeof computeMatchLeverage> & {
    communityContributionsUsd: number;
    matchPoolFundedUsd: number;
  };
  error?: string;
}> {
  const exponent = input.rules.qfExponent ?? DEFAULT_QF_EXPONENT;
  const pool = await getProgramStakePool(input.programId);
  const matchPoolUsd = round(
    Math.min(pool.availableUsd, input.rules.matchPoolUsd ?? pool.principalUsd),
  );

  if (matchPoolUsd < 0.01) {
    return {
      ok: false,
      allocations: 0,
      matchDistributedUsd: 0,
      summary: {
        leverage: 0,
        targetMet: false,
        targetMultiplier: DEFAULT_MATCH_LEVERAGE_TARGET,
        communityContributionsUsd: 0,
        matchPoolFundedUsd: pool.principalUsd,
      },
      error: "match_pool_empty",
    };
  }

  const contributionRows = await prisma.paymentAuthorization.findMany({
    where: {
      missionId: input.missionId,
      eventType: "qf.contribution",
      status: "recognized",
    },
    select: { payeeKey: true, amountUsd: true, evidenceJson: true },
  });

  const contributions = contributionsFromAuthorizations(contributionRows);
  const communityContributionsUsd = round(
    contributions.reduce((s, c) => s + c.amountUsd, 0),
  );

  const scores = computeQfScores(contributions, exponent);
  const allocations = allocateMatchPool(scores, matchPoolUsd);

  if (!allocations.length) {
    return {
      ok: false,
      allocations: 0,
      matchDistributedUsd: 0,
      summary: {
        leverage: 0,
        targetMet: false,
        targetMultiplier: DEFAULT_MATCH_LEVERAGE_TARGET,
        communityContributionsUsd,
        matchPoolFundedUsd: pool.principalUsd,
      },
      error: "no_qf_scores",
    };
  }

  const existingMatch = await prisma.paymentAuthorization.findMany({
    where: { missionId: input.missionId, eventType: "qf.match" },
    select: { payeeKey: true, amountUsd: true },
  });
  const alreadyMatched = new Map(existingMatch.map((r) => [r.payeeKey, r.amountUsd]));

  const events: SettlementInputEvent[] = [];
  for (const alloc of allocations) {
    const prior = alreadyMatched.get(alloc.projectKey) ?? 0;
    const delta = round(alloc.matchUsd - prior);
    if (delta < 0.01) continue;

    const idempotencyKey = `qf:match:${input.missionId}:${alloc.projectKey}`;
    events.push({
      connectorId: "opencollective",
      eventType: "qf.match",
      occurredAt: new Date().toISOString(),
      missionId: input.missionId,
      idempotencyKey,
      payeeKeyType: "opencollective_project",
      payeeKey: alloc.projectKey,
      amountUsd: delta,
      proofHash: sensorProofHash(idempotencyKey),
      confidence: 0.95,
      contextLabel: `QF match · ${alloc.projectKey}`,
      evidenceRefs: [idempotencyKey],
      rawMetadata: { qfScore: alloc.score, share: alloc.share, programId: input.programId },
      policyId: "quadratic-funding",
    });
  }

  if (!events.length) {
    const settled = await prisma.paymentAuthorization.aggregate({
      where: { missionId: input.missionId, eventType: "qf.match", status: "settled" },
      _sum: { amountUsd: true },
    });
    const matchDistributedUsd = settled._sum.amountUsd ?? 0;
    const summary = computeMatchLeverage({
      communityContributionsUsd,
      matchDistributedUsd,
      matchPoolFundedUsd: pool.principalUsd,
    });
    return {
      ok: true,
      allocations: 0,
      matchDistributedUsd,
      summary: { ...summary, communityContributionsUsd, matchPoolFundedUsd: pool.principalUsd },
    };
  }

  await ingestSettlementBatch(events, { founderUserId: input.founderUserId });

  const matchDistributedUsd = round(events.reduce((s, e) => s + e.amountUsd, 0));
  const summary = computeMatchLeverage({
    communityContributionsUsd,
    matchDistributedUsd,
    matchPoolFundedUsd: pool.principalUsd,
  });

  await refreshProgramYieldCache(input.programId);

  return {
    ok: true,
    allocations: events.length,
    matchDistributedUsd,
    summary: { ...summary, communityContributionsUsd, matchPoolFundedUsd: pool.principalUsd },
  };
}
