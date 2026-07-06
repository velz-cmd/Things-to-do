import { COMMUNITY_CATALOG, getCommunityBySlug } from "@/lib/communities/catalog";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";
import {
  buildPreviewValueSignals,
  buildUnpaidValueMetrics,
  gapsHeadlineForProfile,
  getCommunityValueProfile,
  previewAmountUsdForCommunity,
  radarHeadlineForProfile,
} from "@/lib/discover/community-value-profiles";
import { buildPreviewCohortPayees } from "@/lib/discover/preview-cohort-payees";
import {
  MUSIC_MIN_PLAYS,
  MUSIC_PAYOUT_USD,
  RESEARCH_MIN_VIEWS,
  RESEARCH_PAYOUT_USD,
  COHORT_POOL_SIZE,
} from "@/lib/earn/discover-eligibility";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DomainRadarId, TrendingValueGap } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { humanizeExtractionSources } from "@/lib/discover/humanize-sources";

/** Communities with upstream value extraction — preview rows when ledger is empty. */
export const LIVE_SENSOR_COMMUNITY_SLUGS = [
  "react",
  "linux",
  "jellyfin",
  "navidrome",
  "independent-music",
  "open-research",
] as const;

function templateForSlug(slug: string, kind: string): string {
  if (slug === "independent-music" || kind === "music") return "user-centric-royalties";
  if (slug === "jellyfin" || kind === "media") return "video-royalties";
  if (slug === "open-research" || kind === "research") return "citation-toll";
  if (slug === "linux") return "security-fund";
  return "docs-bounty";
}

function domainForKind(kind: string): TrendingValueGap["domain"] {
  if (kind === "music") return "music";
  if (kind === "research") return "research";
  if (kind === "media") return "community";
  return "oss";
}

type PreviewSurface = "gaps" | DomainRadarId;

function liveSignalStory(slug: string): string | null {
  if (slug === "react") {
    return "New verified contributions arrived in the last 24h. A Docs Program can turn future docs work into automatic rewards.";
  }
  if (slug === "linux") {
    return "Security and maintainer activity arrived recently. A Security Fund can keep critical fixes funded before more work piles up.";
  }
  if (slug === "navidrome" || slug === "independent-music") {
    return "Listening activity mapped to 74 artists. A royalty pool can split future payouts by actual plays.";
  }
  if (slug === "jellyfin") {
    return "Playback proof is available for creator rewards. Enable pay-per-minute before more watch time goes unpaid.";
  }
  if (slug === "open-research") {
    return "Citation reuse is measurable, but authors are not receiving rewards from this activity yet.";
  }
  return null;
}

function buildPreviewRow(
  slug: string,
  role: DiscoverRole,
  connections: UserConnectionState | null | undefined,
  surface: PreviewSurface,
): TrendingValueGap | null {
  const entry = getCommunityBySlug(slug) ?? COMMUNITY_CATALOG.find((c) => c.slug === slug);
  if (!entry) return null;

  const profile = getCommunityValueProfile(slug);
  const templateId = templateForSlug(slug, entry.kind);
  const needType = classifyBoardNeedType({
    templateId,
    communitySlug: slug,
    boardKind: "community",
    whyFund: entry.tagline,
    programName: entry.name,
  });

  const isInstalled = communityReadyForDiscover(slug, connections);
  const actions = boardCommunityActions(role, {
    communitySlug: slug,
    templateId,
    needType,
    communityName: entry.name,
    installed: isInstalled,
    connections,
  });

  const headline =
    profile && surface !== "gaps"
      ? radarHeadlineForProfile(profile, surface)
      : profile
        ? gapsHeadlineForProfile(profile)
        : entry.name;

  const why = profile?.unpaidSubtitle ?? "";

  const baseMetrics = buildUnpaidValueMetrics(slug, isInstalled);
  const metrics =
    surface === "gaps"
      ? baseMetrics
      : { ...baseMetrics, story: liveSignalStory(slug) ?? baseMetrics.story };
  const upstream = profile ? humanizeExtractionSources(profile.extractionSources) : entry.name;
  const estimatedAmountUsd = previewAmountUsdForCommunity(slug);
  const previewMetrics = buildUnpaidValueMetrics(slug, isInstalled);
  const cohortPayees = buildPreviewCohortPayees(slug);
  const eligibilityCriteria =
    entry.kind === "music"
      ? `${MUSIC_MIN_PLAYS}+ plays → $${MUSIC_PAYOUT_USD} · pools of ${COHORT_POOL_SIZE}`
      : entry.kind === "research"
        ? `${RESEARCH_MIN_VIEWS}+ views → $${RESEARCH_PAYOUT_USD} · pools of ${COHORT_POOL_SIZE}`
        : `OSS eligibility · pools of ${COHORT_POOL_SIZE}`;

  return {
    id: `value-preview-${surface}-${slug}`,
    domain: domainForKind(entry.kind),
    needType,
    headline,
    why,
    whoBenefits: "",
    proofSource: upstream,
    dataSource: "community_catalog",
    amountVerified: false,
    amountKind: "estimate",
    eligibilityCriteria,
    proofConnectorId: entry.connectors[0],
    amountNeededUsd: estimatedAmountUsd,
    moneyCanMoveUsd: estimatedAmountUsd,
    peopleImpacted: previewMetrics.countValue || cohortPayees.length,
    cohortPayees,
    trendScore: 0,
    communitySlug: slug,
    templateId,
    entityPath: `/communities/${slug}`,
    productLabel: profile?.product,
    ecosystem: profile?.ecosystem,
    valueSignals: buildPreviewValueSignals(slug, isInstalled),
    valueMetrics: metrics,
    actions,
  };
}

/** Value-extraction preview rows — distinct framing per Discover surface. */
export function buildSensorCommunityPreviewRows(
  role: DiscoverRole,
  connections: UserConnectionState | null | undefined = null,
  limit = 5,
  surface: PreviewSurface = "gaps",
): TrendingValueGap[] {
  const rows: TrendingValueGap[] = [];

  for (const slug of LIVE_SENSOR_COMMUNITY_SLUGS) {
    if (rows.length >= limit) break;
    const profile = getCommunityValueProfile(slug);
    if (surface !== "gaps" && profile && !profile.radarFraming[surface]) continue;
    const row = buildPreviewRow(slug, role, connections, surface);
    if (row) rows.push(row);
  }

  return rows;
}

/** Sources that prove real upstream activity — not product tabs. */
export const LIVE_SENSOR_RAIL = [
  {
    id: "github",
    label: "GitHub",
    href: "/profile",
    platform: "github" as const,
    extracts: "PRs · commits · maintainers",
  },
  {
    id: "listenbrainz",
    label: "ListenBrainz",
    href: "/profile",
    platform: "listenbrainz" as const,
    extracts: "Listens · artist graph",
  },
  {
    id: "musicbrainz",
    label: "MusicBrainz",
    href: "/profile",
    platform: "musicbrainz" as const,
    extracts: "Credits · attribution",
  },
  {
    id: "jellyfin",
    label: "Jellyfin",
    href: "/profile",
    platform: "jellyfin" as const,
    extracts: "Watches · sessions",
  },
  {
    id: "navidrome",
    label: "Navidrome",
    href: "/profile",
    platform: "navidrome" as const,
    extracts: "Plays · library",
  },
] as const;
