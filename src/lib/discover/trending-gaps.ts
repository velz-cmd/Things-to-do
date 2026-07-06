import { prisma } from "@/lib/db";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import type { FundingOpportunity } from "@/lib/github/types";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { EntityIds } from "@/lib/domain/entities";
import { entityIdToPath, payeeToEntityId } from "@/lib/entity/paths";
import { resolveFundTarget } from "@/lib/discover/fund-target";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import { estimateOssFundingGap } from "@/lib/discover/valuation-eligibility";
import {
  formatProofSource,
  isMusicAuthorization,
  isResearchAuthorization,
  isSeedGap,
  isVerifiedGap,
} from "@/lib/discover/gap-rules";
import type { TrendingValueGap } from "@/lib/discover/types";
import { enrichGapWithNeedType } from "@/lib/discover/need-types";
import { attachScorecardToGap } from "@/lib/discover/opportunity-score";
import {
  buildMusicCohortGaps,
  buildOssCohortGaps,
  buildResearchCohortGaps,
} from "@/lib/discover/cohort-pool-gaps";

type AuthRow = {
  id: string;
  amountUsd: number;
  payeeKey: string;
  payeeKeyType: string;
  connectorId: string;
  contextLabel: string | null;
  missionId: string | null;
  status: string;
  updatedAt: Date;
};

function entityPathForAuth(r: AuthRow): string | undefined {
  if (r.payeeKeyType === "github_username") {
    return entityIdToPath(EntityIds.personGitHub(r.payeeKey)) ?? undefined;
  }
  if (r.payeeKeyType === "listen_artist") {
    return entityIdToPath(`creator:${r.payeeKey.toLowerCase()}`) ?? undefined;
  }
  if (r.payeeKeyType === "openalex_author") {
    return entityIdToPath(payeeToEntityId(r.payeeKey, r.payeeKeyType)) ?? undefined;
  }
  return entityIdToPath(`payee:${r.payeeKeyType}:${r.payeeKey}`) ?? undefined;
}

async function buildPendingAuthGap(r: AuthRow): Promise<TrendingValueGap> {
  const entityPath = entityPathForAuth(r);
  const fundTarget = r.missionId
    ? await resolveFundTarget({ missionId: r.missionId }).catch(() => null)
    : null;

  const domain: TrendingValueGap["domain"] =
    r.connectorId === "github" ? "oss"
    : isMusicAuthorization(r) ? "music"
    : isResearchAuthorization(r) ? "research"
    : "community";

  const dataSource: TrendingValueGap["dataSource"] =
    isResearchAuthorization(r) ? "openalex"
    : isMusicAuthorization(r) ? "musicbrainz"
    : "supabase_ledger";

  return {
    id: `pending-${r.id}`,
    domain,
    headline: `${r.contextLabel ?? r.payeeKey} — ${r.status === "pending_funding" ? "payment pending funding" : "authorized value"}`,
    why: "Authorization recorded at event time from a live sensor",
    whoBenefits: r.payeeKey,
    proofSource: formatProofSource({
      connectorId: r.connectorId,
      authorizationId: r.id,
      fallback: "RESOLVE ledger",
    }),
    dataSource,
    amountVerified: true,
    proofConnectorId: r.connectorId,
    proofAuthorizationId: r.id,
    amountNeededUsd: r.amountUsd,
    moneyCanMoveUsd: r.amountUsd,
    peopleImpacted: 1,
    trendScore: r.amountUsd * 10 + 100,
    entityPath,
    missionId: r.missionId ?? undefined,
    programId: fundTarget?.programId ?? undefined,
    communitySlug: fundTarget?.communitySlug,
    templateId: fundTarget?.templateId,
    updatedAt: r.updatedAt.toISOString(),
    proofHref: `/receipt/${r.id}`,
    actions: [
      {
        id: "fund",
        label: "Fund",
        kind: "fund",
        programId: fundTarget?.programId ?? undefined,
        missionId: r.missionId ?? undefined,
        communitySlug: fundTarget?.communitySlug,
        templateId: fundTarget?.templateId,
        amountUsd: r.amountUsd,
      },
      ...(entityPath ? [{ id: "open", label: "Open", kind: "open" as const, entityPath }] : []),
      { id: "share", label: "Share receipt", kind: "share", href: `/receipt/${r.id}` },
    ],
  };
}

export type TrendingBuildMeta = {
  gaps: TrendingValueGap[];
  githubScanAt: string | null;
  realSignalCount: number;
};

export type TrendingBuildOpts = {
  ossOpportunities?: FundingOpportunity[];
  fundable?: FundableOpportunity[];
};

/**
 * Ranked value gaps from live scans + ledger only.
 * Excludes static music/catalog cards without proof.
 */
export async function buildTrendingValueGaps(
  limit = 12,
  opts?: TrendingBuildOpts,
): Promise<TrendingBuildMeta> {
  const skipGithub = process.env.CI === "true";
  const hasDb = Boolean(process.env.DATABASE_URL);
  const githubScanAt = skipGithub ? null : new Date().toISOString();

  const [ossOpportunities, fundable, ledgerRows] = await Promise.all([
    opts?.ossOpportunities != null
      ? Promise.resolve(opts.ossOpportunities)
      : skipGithub
        ? Promise.resolve([])
        : cachedScanAllOpportunities().catch(() => []),
    opts?.fundable != null ? Promise.resolve(opts.fundable) : listFundableOpportunities(24),
    hasDb
      ? prisma.paymentAuthorization
          .findMany({
            orderBy: { updatedAt: "desc" },
            take: 48,
            select: {
              id: true,
              amountUsd: true,
              payeeKey: true,
              payeeKeyType: true,
              connectorId: true,
              contextLabel: true,
              missionId: true,
              status: true,
              updatedAt: true,
            },
          })
          .catch(() => [] as AuthRow[])
      : Promise.resolve([] as AuthRow[]),
  ]);

  const gaps: TrendingValueGap[] = [];
  const seenIds = new Set<string>();

  function push(gap: TrendingValueGap) {
    if (seenIds.has(gap.id)) return;
    seenIds.add(gap.id);
    gaps.push(attachScorecardToGap(enrichGapWithNeedType(gap)));
  }

  const ossGapSeeds: Array<{
    id: string;
    fullName: string;
    amountUsd: number;
    communitySlug?: string;
    templateId?: string;
  }> = [];

  for (const o of ossOpportunities.slice(0, 8)) {
    const { communitySlug, templateId } = resolveCommunityForRepo(o.owner, o.repo);

    const valuation = estimateOssFundingGap({
      stars: o.stars,
      forks: o.forks ?? 0,
      mergedPrCount: o.health.mergedPrCount ?? o.highImpactPrs,
      maintainerCount: o.unfundedMaintainers || o.health.maintainerCount,
    });

    if (valuation.usd <= 0) continue;

    ossGapSeeds.push({
      id: `oss-${o.fullName}`,
      fullName: o.fullName,
      amountUsd: valuation.usd,
      communitySlug,
      templateId,
    });
  }

  for (const cohortGap of buildOssCohortGaps(ossGapSeeds)) {
    push(cohortGap);
  }

  for (const o of fundable.filter((p) => p.fundingGapUsd > 0)) {
    push({
      id: `program-${o.programId}`,
      domain: o.templateId === "quadratic-funding" ? "dao" : "community",
      headline: `${o.communityName} — ${o.programName}`,
      why: o.whyFund,
      whoBenefits: o.whoBenefits,
      proofSource: formatProofSource({
        connectorId: "supabase_ledger",
        fallback: `Program ledger · ${o.signalCount} signals`,
      }),
      dataSource: "supabase_ledger",
      amountVerified: true,
      proofConnectorId: "supabase_ledger",
      amountNeededUsd: o.fundingGapUsd,
      moneyCanMoveUsd: o.impactValueUsd,
      peopleImpacted: o.contributorCount,
      trendScore: o.score * 100 + o.fundingGapUsd,
      communitySlug: o.communitySlug,
      programId: o.programId,
      templateId: o.templateId,
      actions: [
        {
          id: "fund",
          label: o.templateId === "quadratic-funding" ? "Fund pool" : "Fulfill",
          kind: "fund",
          programId: o.programId,
          amountUsd: Math.max(25, Math.min(o.fundingGapUsd, 250)),
        },
        {
          id: "sponsor",
          label: "Sponsor",
          kind: "sponsor",
          programId: o.programId,
        },
        {
          id: "open",
          label: "Open community",
          kind: "open",
          href: `/communities/${o.communitySlug}`,
        },
      ],
    });
  }

  const pendingRows = ledgerRows.filter((r) =>
    ["authorized", "pending_funding"].includes(r.status),
  );
  const musicRows = ledgerRows.filter(isMusicAuthorization);
  const researchRows = ledgerRows.filter(isResearchAuthorization);

  const musicByArtist = new Map<string, AuthRow[]>();
  for (const r of musicRows) {
    const key = r.payeeKey.toLowerCase();
    const list = musicByArtist.get(key) ?? [];
    list.push(r);
    musicByArtist.set(key, list);
  }

  const musicArtistEntries = [...musicByArtist.entries()].map(([artistKey, rows]) => ({
    artistKey,
    rows,
  }));
  for (const cohortGap of buildMusicCohortGaps(musicArtistEntries)) {
    push(cohortGap);
  }

  for (const cohortGap of buildResearchCohortGaps(researchRows)) {
    push(cohortGap);
  }

  for (const r of pendingRows.slice(0, 8)) {
    if (isMusicAuthorization(r) || isResearchAuthorization(r)) continue;
    push(await buildPendingAuthGap(r));
  }

  const verifiedCount = gaps.filter(isVerifiedGap).length;

  const sorted = gaps.sort((a, b) => b.trendScore - a.trendScore);

  return {
    gaps: sorted.slice(0, limit),
    githubScanAt,
    realSignalCount: verifiedCount,
  };
}

/** @deprecated use isSeedGap from gap-rules */
export { isSeedGap, isVerifiedGap };
