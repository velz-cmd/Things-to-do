import type { DiscoverAction, DiscoverActionKind } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

/** What users already do on upstream products — extracted, not invented by RESOLVE. */
export type ValueEventKind =
  | "play"
  | "watch"
  | "merge"
  | "commit"
  | "cite"
  | "listen"
  | "fund"
  | "contribute";

export type ValueEventDefinition = {
  kind: ValueEventKind;
  event: string;
  label: string;
  description: string;
};

export type ValueProvidedSignal = {
  event: string;
  label: string;
  source: string;
  count?: number;
  settled: boolean;
  amountUsd?: number;
};

export type CommunityValueProfile = {
  slug: string;
  ecosystem: "Open source" | "Music" | "Video" | "Research";
  product: string;
  upstream: string;
  valueHook: string;
  extractionSources: string[];
  valueEvents: ValueEventDefinition[];
  gapsFraming: string;
  radarFraming: Record<"oss" | "music" | "dao", string | null>;
};

const PROFILES: Record<string, CommunityValueProfile> = {
  jellyfin: {
    slug: "jellyfin",
    ecosystem: "Video",
    product: "Jellyfin server",
    upstream: "Jellyfin",
    valueHook: "Movie and episode watches you already stream become creator authorizations",
    extractionSources: ["Jellyfin Sessions API", "Playback events"],
    valueEvents: [
      {
        kind: "watch",
        event: "video.watch",
        label: "Watches",
        description: "Verified playback sessions from your Jellyfin library",
      },
      {
        kind: "contribute",
        event: "media.catalog",
        label: "Catalog",
        description: "Library metadata tied to credited creators",
      },
    ],
    gapsFraming: "Self-hosted video value is produced at watch time — capital has not settled to creators",
    radarFraming: {
      oss: null,
      music: "Creator video royalties — watches on your Jellyfin server",
      dao: null,
    },
  },
  navidrome: {
    slug: "navidrome",
    ecosystem: "Music",
    product: "Navidrome library",
    upstream: "Navidrome · MusicBrainz",
    valueHook: "Every play in your self-hosted library becomes a royalty authorization",
    extractionSources: ["Navidrome API", "MusicBrainz artist graph"],
    valueEvents: [
      {
        kind: "play",
        event: "music.play",
        label: "Plays",
        description: "Verified listens from your Navidrome instance",
      },
      {
        kind: "listen",
        event: "music.scrobble",
        label: "Scrobbles",
        description: "Listening history attributed to artists and composers",
      },
    ],
    gapsFraming: "Listener-direct plays are value — per-play royalties await funding",
    radarFraming: {
      oss: null,
      music: "Per-play royalties from your Navidrome library",
      dao: null,
    },
  },
  "independent-music": {
    slug: "independent-music",
    ecosystem: "Music",
    product: "Independent music graph",
    upstream: "ListenBrainz · MusicBrainz · Navidrome",
    valueHook: "Cross-platform plays aggregate into user-centric royalty splits",
    extractionSources: ["ListenBrainz", "MusicBrainz", "Navidrome"],
    valueEvents: [
      {
        kind: "listen",
        event: "listen.scrobble",
        label: "Listens",
        description: "Verified listening across connected music sources",
      },
      {
        kind: "play",
        event: "music.play",
        label: "Attributed plays",
        description: "Credits split to artists, composers, and session musicians",
      },
    ],
    gapsFraming: "Artist value from real plays — money has not flowed to participants",
    radarFraming: {
      oss: null,
      music: "User-centric royalties across ListenBrainz and Navidrome",
      dao: null,
    },
  },
  react: {
    slug: "react",
    ecosystem: "Open source",
    product: "React ecosystem",
    upstream: "GitHub · Open Collective",
    valueHook: "Merged PRs, docs, and maintainer labor extracted from public GitHub activity",
    extractionSources: ["GitHub API", "Open Collective treasuries"],
    valueEvents: [
      {
        kind: "merge",
        event: "github.pr.merged",
        label: "Merged PRs",
        description: "Shipped code and documentation from maintainers",
      },
      {
        kind: "commit",
        event: "github.commit",
        label: "Commits",
        description: "Contribution velocity across tracked repositories",
      },
    ],
    gapsFraming: "Maintainer labor is measurable on GitHub — funding gap on docs and core work",
    radarFraming: {
      oss: "UI layer maintainers — docs bounties and dependency funding",
      music: null,
      dao: null,
    },
  },
  linux: {
    slug: "linux",
    ecosystem: "Open source",
    product: "Linux commons",
    upstream: "GitHub · kernel.org",
    valueHook: "Kernel patches, security fixes, and docs work from public contribution graphs",
    extractionSources: ["GitHub API", "Security advisories"],
    valueEvents: [
      {
        kind: "commit",
        event: "github.commit",
        label: "Patches",
        description: "Kernel and desktop commons contributions",
      },
      {
        kind: "contribute",
        event: "security.fix",
        label: "Security fixes",
        description: "CVE response and hardening work",
      },
    ],
    gapsFraming: "Critical infrastructure work is underfunded relative to measured impact",
    radarFraming: {
      oss: "Kernel and desktop sustainability — security and maintainer retention",
      music: null,
      dao: null,
    },
  },
  "open-research": {
    slug: "open-research",
    ecosystem: "Research",
    product: "Open science graph",
    upstream: "OpenAlex · Crossref",
    valueHook: "Citations and paper reuse become micropayment authorizations for researchers",
    extractionSources: ["OpenAlex", "Crossref"],
    valueEvents: [
      {
        kind: "cite",
        event: "research.citation",
        label: "Citations",
        description: "Verified reuse of published research",
      },
      {
        kind: "contribute",
        event: "research.reproduce",
        label: "Reproducibility",
        description: "Replication and dataset contributions",
      },
    ],
    gapsFraming: "Citation value is produced when work is reused — tolls await settlement",
    radarFraming: {
      oss: null,
      music: null,
      dao: "Citation tolls and QF grant pools for open science",
    },
  },
};

export function getCommunityValueProfile(slug: string): CommunityValueProfile | null {
  return PROFILES[slug] ?? null;
}

export function buildPreviewValueSignals(
  slug: string,
  settled: boolean,
): ValueProvidedSignal[] {
  const profile = getCommunityValueProfile(slug);
  if (!profile) return [];

  return profile.valueEvents.map((event) => ({
    event: event.event,
    label: event.label,
    source: profile.extractionSources[0] ?? profile.upstream,
    count: settled ? undefined : 0,
    settled,
    amountUsd: settled ? undefined : 0,
  }));
}

export function gapsHeadlineForProfile(profile: CommunityValueProfile): string {
  return `${profile.product} · ${profile.valueEvents[0]?.label ?? "Value"} from ${profile.upstream}`;
}

export function radarHeadlineForProfile(
  profile: CommunityValueProfile,
  radarId: "oss" | "music" | "dao",
): string {
  const radarLine = profile.radarFraming[radarId];
  if (radarLine) return radarLine;
  return gapsHeadlineForProfile(profile);
}

function connectHrefForSlug(slug: string): string | undefined {
  const map: Record<string, string> = {
    react: "/connect/github",
    linux: "/connect/github",
    jellyfin: "/connect/jellyfin",
    navidrome: "/communities/navidrome",
    "independent-music": "/connect/listenbrainz",
    "open-research": "/profile",
  };
  return map[slug];
}

/** Operational actions — attach is separate prerequisite handled by boardCommunityActions. */
export function operationalActionsForCommunity(
  role: DiscoverRole,
  input: {
    communitySlug: string;
    templateId: string;
    communityName: string;
    installed: boolean;
  },
): DiscoverAction[] {
  const profile = getCommunityValueProfile(input.communitySlug);
  const slug = input.communitySlug;
  const templateId = input.templateId;
  const actions: DiscoverAction[] = [];

  const push = (
    id: string,
    label: string,
    kind: DiscoverActionKind,
    extra: Partial<DiscoverAction> = {},
  ) => {
    actions.push({
      id,
      label,
      kind,
      communitySlug: slug,
      templateId,
      ...extra,
    });
  };

  if (!input.installed) {
    const connectHref = connectHrefForSlug(slug);
    if (connectHref) {
      push("connect", `Connect ${profile?.upstream.split(" · ")[0] ?? "source"}`, "connect_sensor", {
        href: connectHref,
        reason: "Extract real activity before funding",
      });
    }
  }

  switch (slug) {
    case "jellyfin":
      push("fund", "Fund creator pool", "fund", { reason: "Settle video.watch authorizations" });
      push("program", "Launch video royalties", "create_program", {
        templateId: "video-royalties",
      });
      if (input.installed) push("console", "Open Jellyfin console", "console");
      break;
    case "navidrome":
      push("fund", "Fund artist pool", "fund");
      push("program", "Launch per-play royalties", "create_program");
      if (input.installed) push("console", "Open Navidrome console", "console");
      break;
    case "independent-music":
      push("analyze", "View artist graph", "open", { href: "/capital", reason: "See attributed plays" });
      push("fund", "Fund royalties", "fund");
      push("program", "Launch royalty program", "create_program");
      break;
    case "react":
      push("fund", "Fund maintainers", "fund", { reason: "Clear GitHub authorization backlog" });
      push("program", "Launch docs bounty", "create_program", { templateId: "docs-bounty" });
      push("analyze", "View maintainer graph", "open", {
        entityPath: "/communities/react",
      });
      break;
    case "linux":
      push("fund", "Fund security pool", "fund");
      push("program", "Launch security fund", "create_program", {
        templateId: "security-fund",
      });
      push("analyze", "View dependency graph", "open", { entityPath: "/communities/linux" });
      break;
    case "open-research":
      if (role === "dao" || role === "all") {
        push("program", "Launch grant round", "create_program", {
          templateId: "quadratic-funding",
        });
      }
      push("fund", "Fund citation pool", "fund");
      push("analyze", "View researcher graph", "open", {
        entityPath: "/communities/open-research",
      });
      break;
    default:
      push("fund", `Fund ${input.communityName}`, "fund");
      push("program", "Launch program", "create_program");
  }

  if (input.installed && role === "community") {
    return [
      { id: "earn", label: "View earnings", kind: "open", href: "/capital" },
      ...actions.filter((a) => a.kind !== "fund").slice(0, 2),
    ];
  }

  return actions.slice(0, 3);
}
