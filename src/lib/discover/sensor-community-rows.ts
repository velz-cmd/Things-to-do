import { COMMUNITY_CATALOG, getCommunityBySlug } from "@/lib/communities/catalog";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import { buildOpportunityScorecard } from "@/lib/discover/opportunity-score";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { TrendingValueGap } from "@/lib/discover/types";

/** Communities with live RESOLVE sensors — shown as preview rows when ledger is empty. */
export const LIVE_SENSOR_COMMUNITY_SLUGS = [
  "react",
  "linux",
  "jellyfin",
  "navidrome",
  "independent-music",
  "open-research",
] as const;

const SENSOR_CONNECTOR_COPY: Record<string, string> = {
  github: "GitHub sensor",
  jellyfin: "Jellyfin sensor",
  navidrome: "Navidrome bridge",
  listenbrainz: "ListenBrainz",
  musicbrainz: "MusicBrainz",
  openalex: "OpenAlex",
  opencollective: "Open Collective",
};

function templateForSlug(slug: string, kind: string): string {
  if (slug === "independent-music" || kind === "music") return "user-centric-royalties";
  if (slug === "jellyfin" || kind === "media") return "video-royalties";
  if (slug === "open-research" || kind === "research") return "citation-toll";
  return "docs-bounty";
}

function domainForKind(kind: string): TrendingValueGap["domain"] {
  if (kind === "music") return "music";
  if (kind === "research") return "research";
  if (kind === "media") return "community";
  return "oss";
}

/** Real attach/install/fund actions — not placeholder CTAs. */
export function buildSensorCommunityPreviewRows(
  role: DiscoverRole,
  installedSlugs: string[] = [],
  limit = 5,
): TrendingValueGap[] {
  const installed = new Set(installedSlugs);
  const actionRole = role === "all" || role === "community" ? "funder" : role;
  const rows: TrendingValueGap[] = [];

  for (const slug of LIVE_SENSOR_COMMUNITY_SLUGS) {
    if (rows.length >= limit) break;
    const entry = getCommunityBySlug(slug) ?? COMMUNITY_CATALOG.find((c) => c.slug === slug);
    if (!entry) continue;

    const templateId = templateForSlug(slug, entry.kind);
    const needType = classifyBoardNeedType({
      templateId,
      communitySlug: slug,
      boardKind: "community",
      whyFund: entry.tagline,
      programName: entry.name,
    });

    const actions = boardCommunityActions(actionRole, {
      communitySlug: slug,
      templateId,
      needType,
      communityName: entry.name,
      installed: installed.has(slug),
    });

    const sensorLine = entry.connectors
      .map((c) => SENSOR_CONNECTOR_COPY[c] ?? c)
      .join(" · ");

    const opportunityScorecard = buildOpportunityScorecard({
      amountNeededUsd: 0,
      amountVerified: false,
      amountKind: "estimate",
      dataSource: "community_catalog",
      templateId,
      domain: domainForKind(entry.kind),
      maintainerCount: 2,
      sensorGated: false,
      sensorLive: true,
      programCount: 0,
    });

    rows.push({
      id: `sensor-live-${slug}`,
      domain: domainForKind(entry.kind),
      needType,
      headline: `${entry.name} — ${sensorLine}`,
      why: `${entry.tagline} · attach once, sensors sync authorizations to ledger`,
      whoBenefits: entry.doctrine.slice(0, 100),
      proofSource: `Live sensors: ${sensorLine}`,
      dataSource: "community_catalog",
      amountVerified: false,
      amountKind: "estimate",
      eligibilityCriteria: "Ledger ranks after attach + first sensor sync",
      proofConnectorId: entry.connectors[0],
      amountNeededUsd: 0,
      moneyCanMoveUsd: 0,
      peopleImpacted: 0,
      trendScore: opportunityScorecard.composite,
      communitySlug: slug,
      templateId,
      entityPath: `/communities/${slug}`,
      actions,
      opportunityScorecard,
    });
  }

  return rows;
}

export const LIVE_SENSOR_RAIL = [
  { id: "github", label: "GitHub", href: "/connect/github", platform: "github" as const },
  { id: "listenbrainz", label: "ListenBrainz", href: "/connect/listenbrainz", platform: "listenbrainz" as const },
  { id: "musicbrainz", label: "MusicBrainz", href: "/profile", platform: "musicbrainz" as const },
  { id: "jellyfin", label: "Jellyfin", href: "/connect/jellyfin", platform: "jellyfin" as const },
  { id: "navidrome", label: "Navidrome", href: "/communities/navidrome", platform: "navidrome" as const },
] as const;
