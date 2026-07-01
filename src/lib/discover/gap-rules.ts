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
      "Maintainer programs, docs bounties, and security pools appear here as public scans and ledger rows rank up.",
    actionLabel: "Explore React ecosystem",
    actionHref: "/discover#discover-workspace",
  },
  music: {
    id: "music" as const,
    title: "Creator / artist radar",
    message:
      "Royalty programs and play-proof authorizations surface here — Independent Music and Navidrome lead the catalog.",
    actionLabel: "Explore music programs",
    actionHref: "/discover#discover-workspace",
  },
  dao: {
    id: "dao" as const,
    title: "DAO / community radar",
    message:
      "Grant pools, citation tolls, and community programs rank here as treasury and research signals arrive.",
    actionLabel: "Browse grant communities",
    actionHref: "/communities",
  },
};

export function capSeedGaps(gaps: TrendingValueGap[], maxSeeds: number): TrendingValueGap[] {
  const verified = gaps.filter((g) => !isSeedGap(g));
  const seeds = gaps.filter(isSeedGap).slice(0, maxSeeds);
  return [...verified, ...seeds];
}
