import type { DiscoverAction, DiscoverActionKind } from "./types";
import type { DiscoverRole } from "./role-filters";
import type { UserConnectionState } from "../profile/connection-state-types";
import { communityReadyForDiscover } from "./community-profile-link";
import { humanizeExtractionSources } from "./humanize-sources";

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
  /** Honest status — e.g. "awaiting connection", "0 rules" */
  statusText?: string;
};

export type UnpaidValueMetrics = {
  observedEvents: string;
  payoutRules: string;
  settlement: string;
  verifiedSource: string;
};

export type CommunityValueProfile = {
  slug: string;
  ecosystem: "Open source" | "Music" | "Video" | "Research";
  product: string;
  upstream: string;
  /** User-facing unpaid-value title — not integration name */
  unpaidTitle: string;
  unpaidSubtitle: string;
  liveSignalTitle: string;
  extractionSources: string[];
  valueEvents: ValueEventDefinition[];
  radarFraming: Record<"oss" | "music" | "dao", string | null>;
};

const PROFILES: Record<string, CommunityValueProfile> = {
  jellyfin: {
    slug: "jellyfin",
    ecosystem: "Video",
    product: "Jellyfin server",
    upstream: "Jellyfin",
    unpaidTitle: "Jellyfin watch time is not paying creators",
    unpaidSubtitle:
      "Connect play history, create a pay-per-minute rule, then fund the pool.",
    liveSignalTitle: "Self-hosted video watch activity",
    extractionSources: ["Jellyfin", "Playback events"],
    valueEvents: [
      {
        kind: "watch",
        event: "video.watch",
        label: "Watch events",
        description: "Verified playback sessions from your Jellyfin library",
      },
      {
        kind: "contribute",
        event: "media.catalog",
        label: "Catalog items",
        description: "Library metadata tied to credited creators",
      },
    ],
    radarFraming: {
      oss: null,
      music: "Creator video royalties from self-hosted watch sessions",
      dao: null,
    },
  },
  navidrome: {
    slug: "navidrome",
    ecosystem: "Music",
    product: "Navidrome library",
    upstream: "Navidrome · MusicBrainz",
    unpaidTitle: "Navidrome listens are unpaid artist value",
    unpaidSubtitle:
      "Connect play history, map artists with MusicBrainz, then create a royalty pool.",
    liveSignalTitle: "Navidrome play activity",
    extractionSources: ["Navidrome", "MusicBrainz"],
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
    unpaidTitle: "Cross-platform listens with no royalty program",
    unpaidSubtitle:
      "Listens across connected music sources can split to artists — no payout rule is funding claims yet.",
    liveSignalTitle: "User-centric royalty opportunities",
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
    unpaidTitle: "React docs and security work has no payout program",
    unpaidSubtitle:
      "GitHub activity proves contributor work — docs bounties and maintainer pools are not active yet.",
    liveSignalTitle: "React maintainer and docs contributions",
    extractionSources: ["GitHub", "Open Collective"],
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
    unpaidTitle: "Linux commons work is underfunded vs measured impact",
    unpaidSubtitle:
      "Kernel patches and security fixes are verifiable on GitHub — funding pools lag verified work.",
    liveSignalTitle: "Kernel and security contribution activity",
    extractionSources: ["GitHub", "Security advisories"],
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
    unpaidTitle: "Research citations are not settling to authors",
    unpaidSubtitle:
      "OpenAlex and Crossref track when work is cited and reused — citation tolls and grant pools await setup.",
    liveSignalTitle: "Citation and reproducibility activity",
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

export function buildUnpaidValueMetrics(
  slug: string,
  connected: boolean,
): UnpaidValueMetrics {
  const profile = getCommunityValueProfile(slug);
  const source = profile
    ? humanizeExtractionSources(profile.extractionSources)
    : "Your connected sources";
  return {
    observedEvents: connected ? "Activity verified" : "Source not connected",
    payoutRules: "Rule missing",
    settlement: "Pool unfunded",
    verifiedSource: source,
  };
}

export function buildPreviewValueSignals(
  slug: string,
  connected: boolean,
): ValueProvidedSignal[] {
  const profile = getCommunityValueProfile(slug);
  if (!profile) return [];

  const metrics = buildUnpaidValueMetrics(slug, connected);

  const eventSignals = profile.valueEvents.map((event) => ({
    event: event.event,
    label: event.label,
    source: profile.extractionSources[0] ?? profile.upstream,
    count: connected ? undefined : 0,
    settled: false,
    amountUsd: 0,
    statusText: connected ? "live" : "link in Profile",
  }));

  return [
    ...eventSignals,
    {
      event: "payout.rules",
      label: "Payout rules",
      source: "RESOLVE programs",
      settled: false,
      statusText: metrics.payoutRules,
    },
    {
      event: "settlement.status",
      label: "Settlement",
      source: "Arc · Circle",
      settled: false,
      statusText: metrics.settlement,
    },
  ];
}

export function gapsHeadlineForProfile(profile: CommunityValueProfile): string {
  return profile.unpaidTitle;
}

export function radarHeadlineForProfile(
  profile: CommunityValueProfile,
  radarId: "oss" | "music" | "dao",
): string {
  const radarLine = profile.radarFraming[radarId];
  if (radarLine) return radarLine;
  return profile.liveSignalTitle;
}

function connectHrefForSlug(_slug: string): string {
  return "/profile";
}

/** Operational actions — attach is separate prerequisite handled by boardCommunityActions. */
export function operationalActionsForCommunity(
  role: DiscoverRole,
  input: {
    communitySlug: string;
    templateId: string;
    communityName: string;
    installed: boolean;
    connected?: boolean;
    connections?: UserConnectionState | null;
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

  const connected =
    input.connected ??
    input.installed ??
    communityReadyForDiscover(slug, input.connections);

  switch (slug) {
    case "jellyfin":
      if (!connected) {
        push("connect", "Connect Jellyfin", "connect_sensor", {
          href: connectHrefForSlug(slug),
          reason: "Extract watch sessions before creating payout rules",
        });
      }
      push("scan", "Scan watch activity", "analyze", {
        entityPath: `/communities/${slug}`,
        reason: "Import playback events from your server",
      });
      push("program", "Create pay-per-minute rule", "create_program", {
        templateId: "video-royalties",
      });
      push("fund", "Fund creator pool", "fund", {
        reason: "Settle video.watch authorizations on Arc",
      });
      push("proof", "View watch proof", "open", {
        entityPath: `/communities/${slug}`,
      });
      if (input.installed) {
        push("console", "Advanced console", "console");
      }
      break;
    case "navidrome":
      if (!connected) {
        push("connect-lb", "Connect ListenBrainz", "connect_sensor", {
          href: "/connect/listenbrainz",
        });
        push("connect", "Connect Navidrome", "connect_sensor", {
          href: connectHrefForSlug(slug),
        });
      }
      push("scan", "Scan play activity", "analyze", {
        entityPath: `/communities/${slug}`,
      });
      push("program", "Create royalty pool", "create_program", { templateId });
      push("preview", "Preview split", "open", {
        href: "/capital",
        reason: "See user-centric royalty allocation",
      });
      push("fund", "Fund artist pool", "fund");
      if (input.installed) {
        push("console", "Advanced console", "console");
      }
      break;
    case "independent-music":
      if (!connected) {
        push("connect-lb", "Connect ListenBrainz", "connect_sensor", {
          href: "/connect/listenbrainz",
        });
        push("connect-mb", "Map artists (MusicBrainz)", "connect_sensor", {
          href: "/profile",
        });
      }
      push("program", "Create royalty program", "create_program", { templateId });
      push("preview", "Preview split", "open", { href: "/capital" });
      push("fund", "Fund royalties", "fund");
      push("graph", "View artist graph", "open", { href: "/capital" });
      break;
    case "react":
      if (!connected) {
        push("connect", "Connect GitHub", "connect_sensor", {
          href: "/connect/github",
        });
      }
      push("scan", "Scan GitHub activity", "analyze", {
        entityPath: `/communities/${slug}`,
      });
      push("program", "Create docs bounty", "create_program", {
        templateId: "docs-bounty",
      });
      push("fund", "Fund maintainers", "fund", {
        reason: "Clear verified work backlog",
      });
      push("graph", "View contributor graph", "open", {
        entityPath: `/communities/${slug}`,
      });
      break;
    case "linux":
      if (!connected) {
        push("connect", "Connect GitHub", "connect_sensor", {
          href: "/connect/github",
        });
      }
      push("scan", "Scan dependency graph", "analyze", {
        entityPath: `/communities/${slug}`,
      });
      push("program", "Create security fund", "create_program", {
        templateId: "security-fund",
      });
      push("fund", "Fund security pool", "fund");
      push("graph", "View maintainer graph", "open", {
        entityPath: `/communities/${slug}`,
      });
      break;
    case "open-research":
      if (!connected) {
        push("connect", "Connect OpenAlex", "connect_sensor", {
          href: "/profile",
        });
      }
      if (role === "dao" || role === "all") {
        push("grant", "Create grant round", "create_program", {
          templateId: "quadratic-funding",
        });
      }
      push("program", "Create citation toll", "create_program", {
        templateId: "citation-toll",
      });
      push("fund", "Fund research pool", "fund");
      push("graph", "View citation graph", "open", {
        entityPath: `/communities/${slug}`,
      });
      break;
    default:
      if (!connected && connectHrefForSlug(slug)) {
        push("connect", `Connect ${profile?.upstream.split(" · ")[0] ?? "source"}`, "connect_sensor", {
          href: connectHrefForSlug(slug),
        });
      }
      push("fund", `Fund ${input.communityName}`, "fund");
      push("program", "Create payout rule", "create_program");
  }

  if (role === "funder") {
    const fund = actions.find((a) => a.kind === "fund");
    return fund ? [fund] : actions.filter((a) => a.kind === "fund").slice(0, 1);
  }

  return actions.slice(0, 6);
}
