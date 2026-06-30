import { prisma } from "@/lib/db";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
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

function repoPath(owner: string, repo: string) {
  return `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

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
      fallback: "Supabase ledger",
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

function buildMusicAggregateGap(
  artistKey: string,
  rows: AuthRow[],
  communitySlug = "navidrome",
): TrendingValueGap {
  const totalUsd = rows.reduce((s, r) => s + r.amountUsd, 0);
  const latest = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
  const entityPath = entityPathForAuth({ ...latest, payeeKey: artistKey });

  return {
    id: `music-artist-${artistKey.toLowerCase()}`,
    domain: "music",
    headline: `${latest.contextLabel ?? artistKey} — claimable artist value`,
    why: `${rows.length} ListenBrainz/Navidrome authorization${rows.length === 1 ? "" : "s"} in ledger`,
    whoBenefits: "Artists, composers, session musicians",
    proofSource: formatProofSource({
      connectorId: latest.connectorId,
      authorizationId: latest.id,
      fallback: "Supabase ledger",
    }),
    dataSource: "musicbrainz",
    amountVerified: true,
    proofConnectorId: latest.connectorId,
    proofAuthorizationId: latest.id,
    amountNeededUsd: totalUsd,
    moneyCanMoveUsd: totalUsd,
    peopleImpacted: 1,
    trendScore: totalUsd * 12 + 80,
    entityPath,
    communitySlug,
    templateId: "user-centric-royalties",
    updatedAt: latest.updatedAt.toISOString(),
    proofHref: `/receipt/${latest.id}`,
    actions: [
      { id: "claim", label: "Claim artist", kind: "claim", href: "/claim" },
      ...(entityPath ? [{ id: "open", label: "Open", kind: "open" as const, entityPath }] : []),
      {
        id: "fund",
        label: "Fund pool",
        kind: "fund",
        communitySlug,
        templateId: "user-centric-royalties",
      },
      {
        id: "connect",
        label: "Music sensor",
        kind: "connect_sensor",
        href: `/communities/${communitySlug}`,
        communitySlug,
      },
    ],
  };
}

function buildResearchGap(r: AuthRow, communitySlug = "open-research"): TrendingValueGap {
  const entityPath = entityPathForAuth(r);
  const dataSource = r.connectorId === "crossref" ? "openalex" : "openalex";

  return {
    id: `research-${r.id}`,
    domain: "research",
    headline: `${r.contextLabel ?? r.payeeKey} — citation value recognized`,
    why: `Research sensor (${r.connectorId}) recorded an attributable work event`,
    whoBenefits: r.payeeKey,
    proofSource: formatProofSource({
      connectorId: r.connectorId,
      authorizationId: r.id,
      fallback: "Supabase ledger",
    }),
    dataSource,
    amountVerified: true,
    proofConnectorId: r.connectorId,
    proofAuthorizationId: r.id,
    amountNeededUsd: r.amountUsd,
    moneyCanMoveUsd: r.amountUsd,
    peopleImpacted: 1,
    trendScore: r.amountUsd * 8 + 60,
    entityPath,
    communitySlug,
    templateId: "citation-toll",
    updatedAt: r.updatedAt.toISOString(),
    proofHref: `/receipt/${r.id}`,
    actions: [
      ...(entityPath ? [{ id: "open", label: "Open work", kind: "open" as const, entityPath }] : []),
      {
        id: "fund",
        label: "Fund citations",
        kind: "fund",
        communitySlug,
        templateId: "citation-toll",
        amountUsd: r.amountUsd,
      },
      {
        id: "sensor",
        label: "OpenAlex sensor",
        kind: "connect_sensor",
        href: `/communities/${communitySlug}`,
        communitySlug,
      },
      { id: "share", label: "Share receipt", kind: "share", href: `/receipt/${r.id}` },
    ],
  };
}

export type TrendingBuildMeta = {
  gaps: TrendingValueGap[];
  githubScanAt: string | null;
  realSignalCount: number;
};

/**
 * Ranked value gaps from live scans + ledger only.
 * Excludes static music/catalog cards without proof.
 */
export async function buildTrendingValueGaps(limit = 12): Promise<TrendingBuildMeta> {
  const skipGithub = process.env.CI === "true";
  const hasDb = Boolean(process.env.DATABASE_URL);
  const githubScanAt = skipGithub ? null : new Date().toISOString();

  const [ossOpportunities, fundable, ledgerRows] = await Promise.all([
    skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
    listFundableOpportunities(24),
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
    gaps.push(gap);
  }

  for (const o of ossOpportunities.slice(0, 8)) {
    const path = repoPath(o.owner, o.repo);
    const { communitySlug, templateId } = resolveCommunityForRepo(o.owner, o.repo);
    const publicTarget = await resolveFundTarget({ communitySlug, templateId }).catch(() => null);
    const priorityBoost = o.priority === "critical" ? 3 : o.priority === "high" ? 2 : 1;
    const scanAt = githubScanAt ?? new Date().toISOString();

    const valuation = estimateOssFundingGap({
      stars: o.stars,
      forks: o.forks ?? 0,
      mergedPrCount: o.health.mergedPrCount ?? o.highImpactPrs,
      maintainerCount: o.unfundedMaintainers || o.health.maintainerCount,
    });

    push({
      id: `oss-${o.fullName}`,
      domain: "oss",
      headline: `${o.fullName} — ecosystem gap`,
      why: `GitHub scan · est. $${valuation.usd.toFixed(0)} · ${valuation.eligibility}`,
      whoBenefits: `${o.unfundedMaintainers} maintainers · ${o.stars.toLocaleString()} star ecosystem`,
      proofSource: formatProofSource({
        connectorId: "github",
        githubScanAt: scanAt,
        fallback: `GitHub scan · grade ${o.health.grade}`,
      }),
      dataSource: "github",
      amountVerified: false,
      amountKind: "estimate",
      eligibilityCriteria: valuation.eligibility,
      proofConnectorId: "github",
      proofGithubScanAt: scanAt,
      amountNeededUsd: valuation.usd,
      moneyCanMoveUsd: valuation.usd,
      peopleImpacted: o.unfundedMaintainers,
      trendScore: valuation.usd * priorityBoost + o.stars * 0.01,
      entityPath: path,
      communitySlug,
      templateId,
      programId: publicTarget?.programId ?? undefined,
      updatedAt: scanAt,
      actions: [
        { id: "open", label: "Open", kind: "open", entityPath: path },
        {
          id: "fund",
          label: publicTarget?.programId ? "Fund" : "Fund gap",
          kind: "fund",
          programId: publicTarget?.programId ?? undefined,
          communitySlug,
          templateId,
          amountUsd: Math.max(25, Math.min(valuation.usd, 100)),
        },
        {
          id: "bounty",
          label: "Docs bounty",
          kind: "create_program",
          communitySlug,
          templateId,
        },
        {
          id: "sensor",
          label: "GitHub sensor",
          kind: "connect_sensor",
          communitySlug,
          href: `/communities/${communitySlug}`,
        },
        { id: "analyze", label: "Maintainer graph", kind: "analyze", entityPath: path },
      ],
    });
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

  for (const [artistKey, rows] of musicByArtist) {
    push(buildMusicAggregateGap(artistKey, rows));
  }

  for (const r of researchRows.slice(0, 8)) {
    if (pendingRows.some((p) => p.id === r.id)) continue;
    push(buildResearchGap(r));
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
