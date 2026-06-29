import type { CommunityKind } from "@/lib/mission/community/types";

export type CommunityAttachShape = "sidecar" | "plugin" | "wrapper" | "index";

export type CommunityCatalogEntry = {
  slug: string;
  name: string;
  tagline: string;
  kind: CommunityKind;
  attachShape: CommunityAttachShape;
  upstream: string;
  upstreamUrl?: string;
  doctrine: string;
  connectors: string[];
  keywords: string[];
  accent: "violet" | "emerald" | "blue" | "orange";
  featured: boolean;
  installCta: string;
  healthSignals: Array<{ label: string; key: string }>;
};

export const COMMUNITY_CATALOG: CommunityCatalogEntry[] = [
  {
    slug: "independent-music",
    name: "Independent Music",
    tagline: "User-centric royalties for artists, composers, and producers",
    kind: "music",
    attachShape: "sidecar",
    upstream: "ListenBrainz · MusicBrainz · Navidrome",
    doctrine:
      "Every verified play creates an authorization. Credits flow to attributed participants — not platforms.",
    connectors: ["navidrome", "listenbrainz", "musicbrainz"],
    keywords: ["music", "artist", "royalty", "scrobble", "listenbrainz", "navidrome"],
    accent: "violet",
    featured: true,
    installCta: "Install on Independent Music",
    healthSignals: [
      { label: "Scrobble bridge", key: "navidrome" },
      { label: "Attribution", key: "musicbrainz" },
      { label: "Settlement", key: "arc" },
    ],
  },
  {
    slug: "navidrome",
    name: "Navidrome",
    tagline: "Self-hosted music — RESOLVE listens where you already play",
    kind: "music",
    attachShape: "sidecar",
    upstream: "Navidrome",
    upstreamUrl: "https://www.navidrome.org",
    doctrine:
      "Attach RESOLVE to your Navidrome instance. Plays become authorizations; deploy batches settle on Arc.",
    connectors: ["navidrome", "musicbrainz"],
    keywords: ["navidrome", "self-hosted", "scrobble", "music"],
    accent: "emerald",
    featured: true,
    installCta: "Install on Navidrome",
    healthSignals: [
      { label: "Bridge sync", key: "navidrome" },
      { label: "Credits", key: "musicbrainz" },
      { label: "Treasury", key: "treasury" },
    ],
  },
  {
    slug: "react",
    name: "React",
    tagline: "Fund maintainers behind the UI layer the web runs on",
    kind: "oss",
    attachShape: "index",
    upstream: "GitHub · Open Collective",
    doctrine: "Observe contribution signals. Route capital to maintainers with verified impact.",
    connectors: ["github", "opencollective"],
    keywords: ["react", "next.js", "maintainer", "frontend"],
    accent: "blue",
    featured: false,
    installCta: "Install on React",
    healthSignals: [
      { label: "Repos", key: "github" },
      { label: "Funding", key: "opencollective" },
      { label: "Settlement", key: "arc" },
    ],
  },
  {
    slug: "linux",
    name: "Linux",
    tagline: "Kernel and desktop commons — security, docs, maintainer sustainability",
    kind: "oss",
    attachShape: "index",
    upstream: "GitHub · kernel.org",
    doctrine: "Programs for security response, documentation bounties, and maintainer retention.",
    connectors: ["github"],
    keywords: ["linux", "kernel", "gnome", "fedora", "maintainer"],
    accent: "orange",
    featured: false,
    installCta: "Install on Linux",
    healthSignals: [
      { label: "Maintainers", key: "github" },
      { label: "Security", key: "security" },
      { label: "Treasury", key: "treasury" },
    ],
  },
  {
    slug: "open-research",
    name: "Open Research",
    tagline: "Citation tolls and reproducibility incentives for open science",
    kind: "research",
    attachShape: "wrapper",
    upstream: "OpenAlex · Crossref",
    doctrine: "Micropayments on verified citations. Researchers earn when work is reused.",
    connectors: ["openalex", "crossref"],
    keywords: ["research", "citation", "paper", "openalex", "grant"],
    accent: "violet",
    featured: false,
    installCta: "Install on Open Research",
    healthSignals: [
      { label: "Citations", key: "crossref" },
      { label: "Grants", key: "openalex" },
      { label: "Settlement", key: "arc" },
    ],
  },
  {
    slug: "jellyfin",
    name: "Jellyfin",
    tagline: "Self-hosted video — verified watches become creator authorizations",
    kind: "media",
    attachShape: "sidecar",
    upstream: "Jellyfin",
    upstreamUrl: "https://jellyfin.org",
    doctrine:
      "Attach RESOLVE to your Jellyfin server. Movie and episode watches become video.watch authorizations; settle on Arc.",
    connectors: ["jellyfin"],
    keywords: ["jellyfin", "video", "self-hosted", "streaming", "media"],
    accent: "blue",
    featured: true,
    installCta: "Install on Jellyfin",
    healthSignals: [
      { label: "Playback bridge", key: "jellyfin" },
      { label: "Sessions API", key: "jellyfin" },
      { label: "Settlement", key: "arc" },
    ],
  },
];

/** RFB primitive templates — founders operate programs, not chat */
export const PROGRAM_TEMPLATES = {
  "user-centric-royalties": {
    id: "user-centric-royalties",
    name: "User-centric royalties",
    description:
      "RFB #7 — Pay artists per verified play. MusicBrainz splits credits; Arc batches settlement.",
    defaultBudgetUsd: 500,
    defaultRules: {
      perPlayUsd: 0.0004,
      minDurationSec: 30,
      splitMode: "musicbrainz",
      connectorId: "navidrome",
    },
    deployLabel: "Deploy on Arc",
    kinds: ["music"] as CommunityKind[],
  },
  "docs-bounty": {
    id: "docs-bounty",
    name: "Documentation bounty",
    description: "RFB #3 — Reward merged documentation PRs and tutorial authors.",
    defaultBudgetUsd: 2000,
    defaultRules: {
      perMergeUsd: 25,
      minLines: 20,
      connectorId: "github",
      eventType: "docs.merged",
    },
    deployLabel: "Fund docs program",
    kinds: ["oss", "education", "wiki"] as CommunityKind[],
  },
  "security-fund": {
    id: "security-fund",
    name: "Security response fund",
    description: "RFB #4 — CVE triage, patch review, and security maintainer retainers.",
    defaultBudgetUsd: 5000,
    defaultRules: {
      perCveUsd: 150,
      retainerUsd: 500,
      connectorId: "github",
      eventType: "security.advisory",
    },
    deployLabel: "Fund security program",
    kinds: ["oss", "protocol"] as CommunityKind[],
  },
  "quadratic-funding": {
    id: "quadratic-funding",
    name: "Quadratic funding round",
    description: "RFB #6 — Match community contributions with QF amplification on Arc.",
    defaultBudgetUsd: 10000,
    defaultRules: {
      matchPoolUsd: 10000,
      qfExponent: 0.5,
      connectorId: "opencollective",
      eventType: "qf.contribution",
    },
    deployLabel: "Launch QF round",
    kinds: ["oss", "dao", "general"] as CommunityKind[],
  },
  "citation-toll": {
    id: "citation-toll",
    name: "Citation toll",
    description: "RFB #2 — Micropayment per verified citation. Open science economic memory.",
    defaultBudgetUsd: 1000,
    defaultRules: {
      perCitationUsd: 0.05,
      connectorId: "openalex",
      eventType: "citation.verified",
    },
    deployLabel: "Enable citation tolls",
    kinds: ["research", "science", "education"] as CommunityKind[],
  },
  "video-royalties": {
    id: "video-royalties",
    name: "Video watch royalties",
    description: "RFB #7 variant — Pay creators per verified watch on self-hosted Jellyfin.",
    defaultBudgetUsd: 750,
    defaultRules: {
      perWatchUsd: 0.001,
      minDurationSec: 60,
      connectorId: "jellyfin",
      eventType: "video.watch",
    },
    deployLabel: "Deploy video program",
    kinds: ["media"] as CommunityKind[],
  },
} as const;

export type ProgramTemplateId = keyof typeof PROGRAM_TEMPLATES;

export function getCommunityBySlug(slug: string): CommunityCatalogEntry | undefined {
  return COMMUNITY_CATALOG.find((c) => c.slug === slug);
}

export function listFeaturedCommunities(): CommunityCatalogEntry[] {
  return COMMUNITY_CATALOG.filter((c) => c.featured);
}

export function listProgramTemplatesForKind(kind: CommunityKind): (typeof PROGRAM_TEMPLATES)[ProgramTemplateId][] {
  return Object.values(PROGRAM_TEMPLATES).filter((t) => t.kinds.includes(kind));
}
