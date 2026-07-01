import type { TrendingValueGap } from "@/lib/discover/types";

const RESEARCH_CONNECTORS = new Set(["openalex", "crossref"]);
const MUSIC_PAYEE_TYPES = new Set(["listen_artist"]);

export function isVerifiedGap(gap: TrendingValueGap): boolean {
  return Boolean(
    gap.proofAuthorizationId ||
      (gap.amountVerified && gap.proofConnectorId),
  );
}

export function isSeedGap(gap: TrendingValueGap): boolean {
  return gap.id.startsWith("seed-") || gap.dataSource === "catalog_preview";
}

export function gapMatchesRadar(
  gap: TrendingValueGap,
  radar: "oss" | "music" | "dao",
): boolean {
  if (radar === "oss") return gap.domain === "oss" || gap.domain === "protocol";
  if (radar === "music") return gap.domain === "music";
  return gap.domain === "dao" || gap.domain === "community" || gap.domain === "research";
}

export function isMusicAuthorization(row: {
  payeeKeyType: string;
  connectorId: string;
}): boolean {
  return MUSIC_PAYEE_TYPES.has(row.payeeKeyType) || row.connectorId.includes("listen");
}

export function isResearchAuthorization(row: { connectorId: string }): boolean {
  return RESEARCH_CONNECTORS.has(row.connectorId);
}

export function formatProofSource(input: {
  connectorId?: string;
  authorizationId?: string;
  githubScanAt?: string;
  fallback: string;
}): string {
  if (input.authorizationId && input.connectorId) {
    return `${input.connectorId} · authorization ${input.authorizationId.slice(0, 8)}`;
  }
  if (input.githubScanAt) {
    return `GitHub scan · ${new Date(input.githubScanAt).toISOString().slice(0, 19)}Z`;
  }
  if (input.connectorId) {
    return `${input.connectorId} sensor`;
  }
  return input.fallback;
}

export const RADAR_EMPTY_STATES = {
  oss: {
    id: "oss" as const,
    title: "Open source radar",
    message:
      "No ledger-verified maintainer gaps yet. Attach React or Linux and connect GitHub — cards rank here when authorizations or scans arrive.",
    actionLabel: "Attach React",
    actionHref: "/communities/react",
  },
  music: {
    id: "music" as const,
    title: "Creator / artist radar",
    message:
      "No play-proof authorizations in ledger yet. Attach Navidrome and sync ListenBrainz — royalty gaps rank here for funders.",
    actionLabel: "Attach Navidrome",
    actionHref: "/communities/navidrome",
  },
  dao: {
    id: "dao" as const,
    title: "DAO / research radar",
    message:
      "No grant or citation gaps ranked yet. Deploy a QF round or attach Open Research — treasury signals surface here.",
    actionLabel: "Open Research",
    actionHref: "/communities/open-research",
  },
};

export function capSeedGaps(gaps: TrendingValueGap[], maxSeeds: number): TrendingValueGap[] {
  const verified = gaps.filter((g) => !isSeedGap(g));
  const seeds = gaps.filter(isSeedGap).slice(0, maxSeeds);
  return [...verified, ...seeds];
}
