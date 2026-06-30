import type { DiscoverAction, DomainRadarBundle, DomainRadarId, TrendingValueGap } from "@/lib/discover/types";
import { RADAR_EMPTY_STATES } from "./gap-rules";

function contributorGraphPath(entityPath: string) {
  return `${entityPath}#people`;
}

function claimHrefForArtist(entityPath?: string): string {
  if (!entityPath) return "/claim";
  const match = entityPath.match(/^\/e\/artist\/(.+)$/);
  if (!match) return "/claim";
  const payeeKey = decodeURIComponent(match[1]);
  return `/claim?payeeKey=${encodeURIComponent(payeeKey)}&payeeKeyType=listen_artist`;
}

function trimToolbar(actions: DiscoverAction[], max = 5): DiscoverAction[] {
  const seen = new Set<string>();
  const out: DiscoverAction[] = [];
  for (const a of actions) {
    const key = `${a.kind}:${a.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

export function ossCardActions(input: {
  entityPath: string;
  communitySlug: string;
  programId?: string;
  templateId?: string;
  fundingGapUsd?: number;
}): DiscoverAction[] {
  return [
    {
      id: "graph",
      label: "Maintainer graph",
      kind: "analyze",
      entityPath: contributorGraphPath(input.entityPath),
    },
    {
      id: "open",
      label: "Open repo",
      kind: "open",
      entityPath: input.entityPath,
    },
    {
      id: "fund",
      label: "Fund maintainers",
      kind: "fund",
      programId: input.programId,
      communitySlug: input.communitySlug,
      templateId: input.templateId ?? "docs-bounty",
      amountUsd:
        input.fundingGapUsd != null
          ? Math.max(25, Math.min(input.fundingGapUsd, 250))
          : undefined,
    },
    {
      id: "docs",
      label: "Docs bounty",
      kind: "create_program",
      communitySlug: input.communitySlug,
      templateId: "docs-bounty",
    },
    {
      id: "security",
      label: "Security fund",
      kind: "create_program",
      communitySlug: input.communitySlug,
      templateId: "security-fund",
    },
    {
      id: "sensor",
      label: "GitHub sensor",
      kind: "connect_sensor",
      communitySlug: input.communitySlug,
      href: `/communities/${input.communitySlug}#health`,
    },
  ];
}

export function musicCardActions(input: {
  entityPath?: string;
  communitySlug: string;
  programId?: string;
  amountUsd?: number;
  proofHref?: string;
}): DiscoverAction[] {
  const timelinePath = input.entityPath
    ? `${input.entityPath}#timeline`
    : undefined;

  return [
    ...(timelinePath
      ? [
          {
            id: "proof",
            label: "Listen proof",
            kind: "open" as const,
            entityPath: timelinePath,
            href: timelinePath,
          },
        ]
      : []),
    {
      id: "claim",
      label: "Claim artist",
      kind: "claim",
      href: claimHrefForArtist(input.entityPath),
    },
    {
      id: "fund",
      label: "Fund artist",
      kind: "fund",
      programId: input.programId,
      communitySlug: input.communitySlug,
      templateId: "user-centric-royalties",
      amountUsd: input.amountUsd,
    },
    {
      id: "royalty",
      label: "Royalty pool",
      kind: "create_program",
      communitySlug: input.communitySlug,
      templateId: "user-centric-royalties",
    },
    {
      id: "musicbrainz",
      label: "Connect MusicBrainz",
      kind: "connect_sensor",
      href: "/profile",
    },
    ...(input.proofHref
      ? [{ id: "share", label: "Share receipt", kind: "share" as const, href: input.proofHref }]
      : []),
  ];
}

export function daoCardActions(input: {
  programId: string;
  communitySlug: string;
  fundingGapUsd: number;
  templateId: string;
}): DiscoverAction[] {
  const isQf = input.templateId === "quadratic-funding";
  return [
    {
      id: "fund",
      label: isQf ? "Fund grant pool" : "Fund program",
      kind: "fund",
      programId: input.programId,
      amountUsd: Math.max(25, Math.min(input.fundingGapUsd, 500)),
    },
    {
      id: "payroll",
      label: "Contributor payroll",
      kind: "create_program",
      communitySlug: input.communitySlug,
      templateId: "quadratic-funding",
    },
    {
      id: "treasury",
      label: "Connect treasury",
      kind: "connect_sensor",
      communitySlug: input.communitySlug,
      href: `/communities/${input.communitySlug}#treasury`,
    },
    {
      id: "open",
      label: "Open community",
      kind: "open",
      href: `/communities/${input.communitySlug}`,
    },
  ];
}

export function ossToolbar(ctx: {
  entityPath?: string;
  communitySlug: string;
  programId?: string;
  hasLiveData?: boolean;
}): DiscoverAction[] {
  if (!ctx.hasLiveData && !ctx.entityPath) {
    return trimToolbar([
      {
        id: "tb-install",
        label: "Install community",
        kind: "install",
        communitySlug: ctx.communitySlug,
      },
      {
        id: "tb-sensor",
        label: "GitHub sensor",
        kind: "connect_sensor",
        communitySlug: ctx.communitySlug,
        href: `/communities/${ctx.communitySlug}#health`,
      },
    ]);
  }

  const path = ctx.entityPath ?? `/communities/${ctx.communitySlug}`;
  return trimToolbar([
    {
      id: "tb-graph",
      label: "Maintainer graph",
      kind: "analyze",
      entityPath: contributorGraphPath(path),
    },
    {
      id: "tb-fund",
      label: "Fund maintainers",
      kind: "fund",
      programId: ctx.programId,
      communitySlug: ctx.communitySlug,
      templateId: "docs-bounty",
    },
    {
      id: "tb-docs",
      label: "Docs bounty",
      kind: "create_program",
      communitySlug: ctx.communitySlug,
      templateId: "docs-bounty",
    },
    {
      id: "tb-security",
      label: "Security fund",
      kind: "create_program",
      communitySlug: ctx.communitySlug,
      templateId: "security-fund",
    },
    {
      id: "tb-sensor",
      label: "GitHub sensor",
      kind: "connect_sensor",
      communitySlug: ctx.communitySlug,
      href: `/communities/${ctx.communitySlug}#health`,
    },
  ]);
}

export function musicToolbar(ctx: {
  entityPath?: string;
  communitySlug: string;
  programId?: string;
}): DiscoverAction[] {
  return trimToolbar([
    {
      id: "tb-mb",
      label: "Connect MusicBrainz",
      kind: "connect_sensor",
      href: "/profile",
    },
    {
      id: "tb-royalty",
      label: "Royalty pool",
      kind: "create_program",
      communitySlug: ctx.communitySlug,
      templateId: "user-centric-royalties",
    },
    {
      id: "tb-fund",
      label: "Fund artist",
      kind: "fund",
      programId: ctx.programId,
      communitySlug: ctx.communitySlug,
      templateId: "user-centric-royalties",
    },
    {
      id: "tb-claim",
      label: "Claim artist",
      kind: "claim",
      href: claimHrefForArtist(ctx.entityPath),
    },
    ...(ctx.entityPath
      ? [
          {
            id: "tb-proof",
            label: "Listen proof",
            kind: "open" as const,
            entityPath: `${ctx.entityPath}#timeline`,
            href: `${ctx.entityPath}#timeline`,
          },
        ]
      : []),
  ]);
}

export function daoToolbar(ctx: {
  communitySlug: string;
  programId?: string;
  fundingGapUsd?: number;
}): DiscoverAction[] {
  return trimToolbar([
    {
      id: "tb-qf",
      label: "Fund grant pool",
      kind: "fund",
      programId: ctx.programId,
      communitySlug: ctx.communitySlug,
      templateId: "quadratic-funding",
      amountUsd: ctx.fundingGapUsd,
    },
    {
      id: "tb-payroll",
      label: "Contributor payroll",
      kind: "create_program",
      communitySlug: ctx.communitySlug,
      templateId: "quadratic-funding",
    },
    {
      id: "tb-treasury",
      label: "Connect treasury",
      kind: "connect_sensor",
      communitySlug: ctx.communitySlug,
      href: `/communities/${ctx.communitySlug}#treasury`,
    },
    {
      id: "tb-open",
      label: "Open community",
      kind: "open",
      href: `/communities/${ctx.communitySlug}`,
    },
  ]);
}

export function enrichOssCard(card: TrendingValueGap): TrendingValueGap {
  if (!card.entityPath || !card.communitySlug) return card;
  return {
    ...card,
    actions: ossCardActions({
      entityPath: card.entityPath,
      communitySlug: card.communitySlug,
      programId: card.programId,
      templateId: card.templateId,
      fundingGapUsd: card.amountNeededUsd > 0 ? card.amountNeededUsd : undefined,
    }),
  };
}

export function enrichMusicCard(card: TrendingValueGap): TrendingValueGap {
  return {
    ...card,
    actions: musicCardActions({
      entityPath: card.entityPath,
      communitySlug: card.communitySlug ?? "navidrome",
      programId: card.programId,
      amountUsd: card.amountVerified ? card.amountNeededUsd : undefined,
      proofHref: card.proofHref,
    }),
  };
}

export function enrichDaoCard(card: TrendingValueGap): TrendingValueGap {
  if (!card.programId || !card.communitySlug) return card;
  return {
    ...card,
    actions: daoCardActions({
      programId: card.programId,
      communitySlug: card.communitySlug,
      fundingGapUsd: card.amountNeededUsd,
      templateId: card.templateId ?? "quadratic-funding",
    }),
  };
}

export function bundleMeta(id: DomainRadarId): { title: string; tagline: string } {
  if (id === "oss") {
    return {
      title: "Open source radar",
      tagline: "Maintainer graphs, docs bounties, security funds — GitHub sensor required",
    };
  }
  if (id === "music") {
    return {
      title: "Creator / artist radar",
      tagline: "MusicBrainz attribution, royalty pools, and listen-proof authorizations",
    };
  }
  return {
    title: "DAO / research radar",
    tagline: "Grant pools, citation tolls, contributor payroll, and treasury connectors",
  };
}

export function emptyBundle(id: DomainRadarId): DomainRadarBundle {
  const meta = bundleMeta(id);
  const emptyState = RADAR_EMPTY_STATES[id];
  const communitySlug = id === "music" ? "navidrome" : "react";
  const toolbar =
    id === "oss" ? ossToolbar({ communitySlug: "react" })
    : id === "music" ? musicToolbar({ communitySlug: "navidrome" })
    : daoToolbar({ communitySlug: "react" });

  return {
    id,
    title: meta.title,
    tagline: meta.tagline,
    cards: [],
    toolbar,
    emptyState,
    hasLiveData: false,
  };
}
