import {
  batchIntoCohorts,
  COHORT_POOL_SIZE,
  MUSIC_PAYOUT_USD,
  RESEARCH_PAYOUT_USD,
  OSS_PAYOUT_USD,
} from "@/lib/earn/discover-eligibility";
import type { TrendingValueGap } from "@/lib/discover/types";

type CohortMember = {
  key: string;
  label: string;
  amountUsd: number;
};

function cohortHeadline(domain: string, count: number, communityLabel: string): string {
  return `${count} ${domain} · shared pool (${communityLabel})`;
}

function baseCohortGap(input: {
  id: string;
  domain: TrendingValueGap["domain"];
  headline: string;
  why: string;
  whoBenefits: string;
  communitySlug: string;
  templateId: string;
  members: CohortMember[];
  proofAuthorizationId?: string;
  proofConnectorId?: string;
  dataSource: TrendingValueGap["dataSource"];
}): TrendingValueGap {
  const totalUsd = input.members.reduce((s, m) => s + m.amountUsd, 0);
  const count = input.members.length;
  const perPerson = count > 0 ? totalUsd / count : 0;

  return {
    id: input.id,
    domain: input.domain,
    headline: input.headline,
    why: input.why,
    whoBenefits: input.whoBenefits,
    proofSource: "RESOLVE ledger · batched eligibility pool",
    dataSource: input.dataSource,
    amountVerified: true,
    amountKind: "estimate",
    eligibilityCriteria: `${count} payees × $${perPerson.toFixed(0)} avg · ${COHORT_POOL_SIZE}-person pool batches`,
    proofConnectorId: input.proofConnectorId,
    proofAuthorizationId:
      input.dataSource === "supabase_ledger" ? input.proofAuthorizationId : undefined,
    cohortPayees: input.members.map((m) => ({ label: m.label, owedUsd: m.amountUsd })),
    amountNeededUsd: totalUsd,
    moneyCanMoveUsd: totalUsd,
    peopleImpacted: count,
    trendScore: totalUsd * 15 + count * 40,
    communitySlug: input.communitySlug,
    templateId: input.templateId,
    actions: [
      {
        id: "fund",
        label: "Fulfill pool",
        kind: "fund",
        communitySlug: input.communitySlug,
        templateId: input.templateId,
        amountUsd: Math.max(5, Math.min(totalUsd, 250)),
      },
      {
        id: "connect",
        label: "Program rules",
        kind: "install",
        communitySlug: input.communitySlug,
      },
    ],
  };
}

export function buildMusicCohortGaps(
  artistEntries: Array<{ artistKey: string; rows: Array<{ amountUsd: number; contextLabel: string | null; id: string; connectorId: string }> }>,
  communitySlug = "navidrome",
): TrendingValueGap[] {
  const members: CohortMember[] = artistEntries.map(({ artistKey, rows }) => {
    const total = rows.reduce((s, r) => s + r.amountUsd, 0);
    const label = rows[0]?.contextLabel ?? artistKey;
    return {
      key: artistKey,
      label,
      amountUsd: total > 0 ? total : MUSIC_PAYOUT_USD,
    };
  });

  if (members.length === 0) return [];

  return batchIntoCohorts(members).map((cohort, index) =>
    baseCohortGap({
      id: `music-cohort-${communitySlug}-${index}`,
      domain: "music",
      headline: cohortHeadline(
        cohort.length === 1 ? "artist" : "artists",
        cohort.length,
        "ListenBrainz · MusicBrainz",
      ),
      why: `${cohort.length} verified artist${cohort.length === 1 ? "" : "s"} batched into one royalty pool — fund once, settle by stake.`,
      whoBenefits: "Artists, composers, session musicians",
      communitySlug,
      templateId: "user-centric-royalties",
      members: cohort,
      proofAuthorizationId: artistEntries[0]?.rows[0]?.id,
      proofConnectorId: artistEntries[0]?.rows[0]?.connectorId ?? "listenbrainz",
      dataSource: "musicbrainz",
    }),
  );
}

export function buildResearchCohortGaps(
  rows: Array<{ id: string; payeeKey: string; amountUsd: number; contextLabel: string | null; connectorId: string }>,
  communitySlug = "open-research",
): TrendingValueGap[] {
  const members: CohortMember[] = rows.map((r) => ({
    key: r.payeeKey,
    label: r.contextLabel ?? r.payeeKey,
    amountUsd: r.amountUsd > 0 ? r.amountUsd : RESEARCH_PAYOUT_USD,
  }));

  return batchIntoCohorts(members).map((cohort, index) =>
    baseCohortGap({
      id: `research-cohort-${index}`,
      domain: "research",
      headline: cohortHeadline(
        cohort.length === 1 ? "researcher" : "researchers",
        cohort.length,
        "OpenAlex · Crossref",
      ),
      why: `${cohort.length} attributed work${cohort.length === 1 ? "" : "s"} batched — $${RESEARCH_PAYOUT_USD} per 1,000 views at eligibility.`,
      whoBenefits: "Authors and research contributors",
      communitySlug,
      templateId: "citation-toll",
      members: cohort,
      proofAuthorizationId: cohort[0] ? rows.find((r) => r.payeeKey === cohort[0]!.key)?.id : undefined,
      proofConnectorId: rows[0]?.connectorId ?? "openalex",
      dataSource: "openalex",
    }),
  );
}

export function buildOssCohortGaps(
  repos: Array<{ id: string; fullName: string; amountUsd: number; communitySlug?: string; templateId?: string }>,
): TrendingValueGap[] {
  const members: CohortMember[] = repos.map((r) => ({
    key: r.id,
    label: r.fullName,
    amountUsd: r.amountUsd > 0 ? r.amountUsd : OSS_PAYOUT_USD,
  }));

  return batchIntoCohorts(members).map((cohort, index) => {
    const slug = repos[0]?.communitySlug ?? "react";
    return baseCohortGap({
      id: `oss-cohort-${index}`,
      domain: "oss",
      headline: cohortHeadline(
        cohort.length === 1 ? "repo" : "repos",
        cohort.length,
        "GitHub",
      ),
      why: `${cohort.length} OSS program${cohort.length === 1 ? "" : "s"} share one funder pool — $${OSS_PAYOUT_USD} per qualifying maintainer batch.`,
      whoBenefits: "Maintainers and contributors",
      communitySlug: slug,
      templateId: repos[0]?.templateId ?? "docs-bounty",
      members: cohort,
      proofConnectorId: "github",
      dataSource: "github",
    });
  });
}
