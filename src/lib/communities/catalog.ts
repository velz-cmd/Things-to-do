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
];

export const PROGRAM_TEMPLATES = {
  "user-centric-royalties": {
    id: "user-centric-royalties",
    name: "User-centric royalties",
    description:
      "Pay artists per verified play. MusicBrainz splits credits; Arc batches settlement.",
    defaultBudgetUsd: 500,
    defaultRules: {
      perPlayUsd: 0.0004,
      minDurationSec: 30,
      splitMode: "musicbrainz",
      connectorId: "navidrome",
    },
    deployLabel: "Deploy on Arc",
  },
} as const;

export type ProgramTemplateId = keyof typeof PROGRAM_TEMPLATES;

export function getCommunityBySlug(slug: string): CommunityCatalogEntry | undefined {
  return COMMUNITY_CATALOG.find((c) => c.slug === slug);
}

export function listFeaturedCommunities(): CommunityCatalogEntry[] {
  return COMMUNITY_CATALOG.filter((c) => c.featured);
}
