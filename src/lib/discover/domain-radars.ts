import { prisma } from "@/lib/db";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { resolveFundTarget } from "@/lib/discover/fund-target";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import {
  formatProofSource,
  isMusicAuthorization,
  isResearchAuthorization,
  isVerifiedGap,
  RADAR_EMPTY_STATES,
} from "@/lib/discover/gap-rules";
import {
  bundleMeta,
  daoToolbar,
  enrichDaoCard,
  enrichMusicCard,
  enrichOssCard,
  musicToolbar,
  ossToolbar,
} from "@/lib/discover/domain-radar-actions";
import type { DomainRadarBundle, TrendingValueGap } from "@/lib/discover/types";

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

/** Build vertical-specific radar bundles — not a filtered trending list. */
export async function buildDomainRadars(): Promise<{
  oss: DomainRadarBundle;
  music: DomainRadarBundle;
  dao: DomainRadarBundle;
}> {
  const skipGithub = process.env.CI === "true";
  const hasDb = Boolean(process.env.DATABASE_URL);

  const [ossOpportunities, fundable, ledgerRows] = await Promise.all([
    skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
    listFundableOpportunities(24),
    hasDb
      ? prisma.paymentAuthorization
          .findMany({
            orderBy: { updatedAt: "desc" },
            take: 32,
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

  const ossCards: TrendingValueGap[] = [];
  const musicCards: TrendingValueGap[] = [];
  const daoCards: TrendingValueGap[] = [];

  const scanAt = skipGithub ? null : new Date().toISOString();

  for (const o of ossOpportunities.slice(0, 4)) {
    const path = repoPath(o.owner, o.repo);
    const { communitySlug, templateId } = resolveCommunityForRepo(o.owner, o.repo);
    const publicTarget = await resolveFundTarget({ communitySlug, templateId }).catch(() => null);

    const card: TrendingValueGap = {
      id: `radar-oss-${o.fullName}`,
      domain: "oss",
      headline: o.fullName,
      why: o.headline,
      whoBenefits: `${o.unfundedMaintainers} maintainers · ${o.stars.toLocaleString()} stars`,
      proofSource: formatProofSource({
        connectorId: "github",
        githubScanAt: scanAt ?? undefined,
        fallback: `GitHub · grade ${o.health.grade}`,
      }),
      dataSource: "github",
      amountVerified: false,
      amountKind: "estimate",
      proofConnectorId: "github",
      proofGithubScanAt: scanAt ?? undefined,
      amountNeededUsd: o.health.fundingGapUsd,
      moneyCanMoveUsd: o.health.fundingGapUsd,
      peopleImpacted: o.unfundedMaintainers,
      trendScore: o.health.fundingGapUsd,
      entityPath: path,
      communitySlug,
      templateId,
      programId: publicTarget?.programId ?? undefined,
      updatedAt: scanAt ?? undefined,
      actions: [],
    };
    ossCards.push(enrichOssCard(card));
  }

  const githubAuths = ledgerRows.filter((r) => r.connectorId === "github");
  for (const r of githubAuths.slice(0, 2)) {
    if (ossCards.length >= 4) break;
    const fundTarget = r.missionId
      ? await resolveFundTarget({ missionId: r.missionId }).catch(() => null)
      : null;
    const card: TrendingValueGap = {
      id: `radar-oss-auth-${r.id}`,
      domain: "oss",
      headline: `${r.contextLabel ?? r.payeeKey} — GitHub authorization`,
      why: "Maintainer value recognized by GitHub sensor",
      whoBenefits: r.payeeKey,
      proofSource: formatProofSource({
        connectorId: r.connectorId,
        authorizationId: r.id,
        fallback: "Supabase ledger",
      }),
      dataSource: "supabase_ledger",
      amountVerified: true,
      proofConnectorId: r.connectorId,
      proofAuthorizationId: r.id,
      amountNeededUsd: r.amountUsd,
      moneyCanMoveUsd: r.amountUsd,
      peopleImpacted: 1,
      trendScore: r.amountUsd * 10,
      entityPath: `/e/maintainer/github/${encodeURIComponent(r.payeeKey)}`,
      communitySlug: fundTarget?.communitySlug ?? "react",
      programId: fundTarget?.programId ?? undefined,
      templateId: fundTarget?.templateId ?? "docs-bounty",
      updatedAt: r.updatedAt.toISOString(),
      proofHref: `/receipt/${r.id}`,
      actions: [],
    };
    ossCards.push(enrichOssCard(card));
  }

  const musicRows = ledgerRows.filter(isMusicAuthorization);
  const musicByArtist = new Map<string, AuthRow[]>();
  for (const r of musicRows) {
    const key = r.payeeKey.toLowerCase();
    const list = musicByArtist.get(key) ?? [];
    list.push(r);
    musicByArtist.set(key, list);
  }

  for (const [artistKey, rows] of [...musicByArtist.entries()].slice(0, 4)) {
    const total = rows.reduce((s, r) => s + r.amountUsd, 0);
    const latest = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    const entityPath = `/e/artist/${encodeURIComponent(artistKey)}`;
    const fundTarget = latest.missionId
      ? await resolveFundTarget({ missionId: latest.missionId }).catch(() => null)
      : null;

    const card: TrendingValueGap = {
      id: `radar-music-${artistKey}`,
      domain: "music",
      headline: latest.contextLabel ?? artistKey,
      why: `${rows.length} play authorization${rows.length === 1 ? "" : "s"} in ledger`,
      whoBenefits: "Artists and session musicians",
      proofSource: formatProofSource({
        connectorId: latest.connectorId,
        authorizationId: latest.id,
        fallback: "ListenBrainz / Navidrome",
      }),
      dataSource: "musicbrainz",
      amountVerified: true,
      proofConnectorId: latest.connectorId,
      proofAuthorizationId: latest.id,
      amountNeededUsd: total,
      moneyCanMoveUsd: total,
      peopleImpacted: 1,
      trendScore: total * 12,
      entityPath,
      communitySlug: fundTarget?.communitySlug ?? "navidrome",
      programId: fundTarget?.programId ?? undefined,
      templateId: "user-centric-royalties",
      updatedAt: latest.updatedAt.toISOString(),
      proofHref: `/receipt/${latest.id}`,
      actions: [],
    };
    musicCards.push(enrichMusicCard(card));
  }

  const daoPrograms = fundable.filter(
    (p) =>
      p.fundingGapUsd > 0 &&
      (p.templateId === "quadratic-funding" ||
        p.templateId === "citation-toll" ||
        p.templateId === "docs-bounty"),
  );

  for (const o of daoPrograms.slice(0, 4)) {
    const domain: TrendingValueGap["domain"] =
      o.templateId === "quadratic-funding" ? "dao" : "research";
    const card: TrendingValueGap = {
      id: `radar-dao-${o.programId}`,
      domain,
      headline: `${o.communityName} — ${o.programName}`,
      why: o.whyFund,
      whoBenefits: o.whoBenefits,
      proofSource: formatProofSource({
        connectorId: "supabase_ledger",
        fallback: `${o.signalCount} signals · ${o.contributorCount} contributors`,
      }),
      dataSource: "supabase_ledger",
      amountVerified: true,
      proofConnectorId: "supabase_ledger",
      amountNeededUsd: o.fundingGapUsd,
      moneyCanMoveUsd: o.impactValueUsd,
      peopleImpacted: o.contributorCount,
      trendScore: o.score * 100,
      communitySlug: o.communitySlug,
      programId: o.programId,
      templateId: o.templateId,
      actions: [],
    };
    daoCards.push(enrichDaoCard(card));
  }

  for (const r of ledgerRows.filter(isResearchAuthorization).slice(0, 2)) {
    if (daoCards.length >= 4) break;
    const card: TrendingValueGap = {
      id: `radar-research-${r.id}`,
      domain: "research",
      headline: r.contextLabel ?? r.payeeKey,
      why: `Citation value from ${r.connectorId}`,
      whoBenefits: r.payeeKey,
      proofSource: formatProofSource({
        connectorId: r.connectorId,
        authorizationId: r.id,
        fallback: "OpenAlex / Crossref",
      }),
      dataSource: "openalex",
      amountVerified: true,
      proofConnectorId: r.connectorId,
      proofAuthorizationId: r.id,
      amountNeededUsd: r.amountUsd,
      moneyCanMoveUsd: r.amountUsd,
      peopleImpacted: 1,
      trendScore: r.amountUsd * 8,
      communitySlug: "open-research",
      templateId: "citation-toll",
      updatedAt: r.updatedAt.toISOString(),
      proofHref: `/receipt/${r.id}`,
      actions: [],
    };
    daoCards.push({
      ...card,
      actions: [
        {
          id: "fund",
          label: "Fund citations",
          kind: "fund",
          communitySlug: "open-research",
          templateId: "citation-toll",
          amountUsd: r.amountUsd,
        },
        {
          id: "sensor",
          label: "OpenAlex sensor",
          kind: "connect_sensor",
          href: "/communities/open-research#health",
          communitySlug: "open-research",
        },
        { id: "share", label: "Share receipt", kind: "share", href: `/receipt/${r.id}` },
      ],
    });
  }

  const featuredOss = ossCards[0];
  const featuredMusic = musicCards[0];
  const featuredDao = daoPrograms[0];

  const ossBundle: DomainRadarBundle = {
    id: "oss",
    ...bundleMeta("oss"),
    cards: ossCards,
    hasLiveData: ossCards.some(isVerifiedGap),
    emptyState: RADAR_EMPTY_STATES.oss,
    toolbar: ossToolbar({
      entityPath: featuredOss?.entityPath,
      communitySlug: featuredOss?.communitySlug ?? "react",
      programId: featuredOss?.programId,
      hasLiveData: ossCards.some(isVerifiedGap),
    }),
  };

  const musicBundle: DomainRadarBundle = {
    id: "music",
    ...bundleMeta("music"),
    cards: musicCards,
    hasLiveData: musicCards.some(isVerifiedGap),
    emptyState: RADAR_EMPTY_STATES.music,
    toolbar: musicToolbar({
      entityPath: featuredMusic?.entityPath,
      communitySlug: featuredMusic?.communitySlug ?? "navidrome",
      programId: featuredMusic?.programId,
    }),
  };

  const daoBundle: DomainRadarBundle = {
    id: "dao",
    ...bundleMeta("dao"),
    cards: daoCards,
    hasLiveData: daoCards.some(isVerifiedGap),
    emptyState: RADAR_EMPTY_STATES.dao,
    toolbar: daoToolbar({
      communitySlug: featuredDao?.communitySlug ?? "react",
      programId: featuredDao?.programId,
      fundingGapUsd: featuredDao?.fundingGapUsd,
    }),
  };

  return { oss: ossBundle, music: musicBundle, dao: daoBundle };
}
