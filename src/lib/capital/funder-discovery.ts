import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG, getCommunityBySlug } from "@/lib/communities/catalog";
import {
  computeYieldMultiplier,
  DEFAULT_TARGET_YIELD_MULTIPLIER,
  fundingGapForTarget,
  templateLabel,
  whyFundCopy,
  type FundableOpportunity,
} from "@/lib/capital/community-yield";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import { computeProgramYield, programDiscoveryMetrics } from "@/lib/capital/yield-service";
import { scorecardFromFundable } from "@/lib/discover/opportunity-score";

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const rows = await Promise.all(chunk.map(fn));
    for (const row of rows) {
      if (row !== null) out.push(row);
    }
  }
  return out;
}

/** Programs any funder can discover — no need to know the community beforehand */
export async function listFundableOpportunities(limit = 24): Promise<FundableOpportunity[]> {
  if (!process.env.DATABASE_URL) return [];

  const programs = await prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    include: { install: { select: { communitySlug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 48,
  });

  const opportunities = await mapInBatches(programs, 6, async (p) => {
        try {
          const slug = p.install?.communitySlug ?? "unknown";
          const community = getCommunityBySlug(slug);
          const { measure, yield: yieldSnap, signalCount, contributorCount } =
            await programDiscoveryMetrics(p.id, p.userId);

          const impactValueUsd = yieldSnap?.impactValueUsd ?? 0;
          const principalFundedUsd = yieldSnap?.principalFundedUsd ?? p.budgetUsd;
          const targetMultiplier = DEFAULT_TARGET_YIELD_MULTIPLIER;
          const yieldMultiplier = computeYieldMultiplier(impactValueUsd, principalFundedUsd);
          const fundingGapUsd =
            yieldSnap?.fundingGapUsd ??
            fundingGapForTarget(impactValueUsd, principalFundedUsd, targetMultiplier);
          const settlementRate = measure?.metrics.settlementRate ?? 0;
          const pendingFundingUsd = yieldSnap?.missionId
            ? (await getAuthorizationSummary({ missionId: yieldSnap.missionId })).pendingFundingUsd
            : 0;
          const { whyFund, whoBenefits } = whyFundCopy({
            templateId: p.templateId,
            communityName: community?.name ?? slug,
            fundingGapUsd,
            settlementRate,
            pendingFundingUsd,
          });

          return {
            programId: p.id,
            programName: p.name,
            communitySlug: slug,
            communityName: community?.name ?? slug,
            communityTagline: community?.tagline ?? "",
            templateId: p.templateId,
            templateLabel: templateLabel(p.templateId),
            status: p.status,
            budgetUsd: p.budgetUsd,
            principalFundedUsd,
            fundingGapUsd,
            impactValueUsd,
            projectedYieldAt2x: round(principalFundedUsd * targetMultiplier),
            yieldMultiplier,
            targetMultiplier,
            settlementRate,
            contributorCount,
            signalCount,
            whyFund,
            whoBenefits,
            score: 0,
            metricKind: yieldSnap?.metricKind ?? "fulfillment",
            needType: classifyBoardNeedType({
              templateId: p.templateId,
              communitySlug: slug,
              boardKind: "program",
              whyFund,
              programName: p.name,
            }),
          } satisfies FundableOpportunity & { needType: import("@/lib/discover/need-types").DiscoverNeedType };
        } catch (e) {
          console.warn("[funder-discovery] program metrics failed:", p.id, e);
          return null;
        }
      });

  const scored = opportunities as FundableOpportunity[];
  for (const o of scored) {
    o.opportunityScorecard = scorecardFromFundable(o);
    o.score = o.opportunityScorecard.composite;
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Communities without an active program yet — attach + fund path */
export async function listCommunitiesNeedingFirstFunder() {
  const installedSlugs = new Set(
    (
      await prisma.resolveProgram.findMany({
        where: { status: { in: ["active", "deployed"] } },
        include: { install: { select: { communitySlug: true } } },
      })
    ).map((p) => p.install?.communitySlug).filter(Boolean),
  );

  return COMMUNITY_CATALOG.filter((c) => c.featured && !installedSlugs.has(c.slug)).slice(0, 8);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getOpportunityDetail(programId: string) {
  const program = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: { install: { select: { communitySlug: true } } },
  });
  if (!program) return null;

  const yieldSnap = await computeProgramYield(programId);
  const slug = program.install?.communitySlug ?? "unknown";
  const community = getCommunityBySlug(slug);

  return {
    program,
    community,
    yield: yieldSnap,
  };
}
