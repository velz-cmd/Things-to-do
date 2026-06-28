import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getInstall } from "@/lib/communities/installs";
import { listProgramsForCommunity } from "@/lib/communities/programs";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { buildLiveTimeline } from "@/lib/mission/server/timeline";
import type { CommunityImpactChain, CommunitySurface } from "./types";

function buildImpactChain(input: {
  treasuryUsd: number;
  programBudgetUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  playCount: number;
  artistCount: number;
}): CommunityImpactChain {
  const estImpact = Math.round(input.playCount * 3.2);
  return {
    treasuryUsd: input.treasuryUsd,
    programBudgetUsd: input.programBudgetUsd,
    authorizedUsd: input.authorizedUsd,
    settledUsd: input.settledUsd,
    playCount: input.playCount,
    artistCount: input.artistCount,
    estimatedListeners: estImpact,
    stages: [
      {
        id: "capital",
        label: "Capital",
        value: `$${input.treasuryUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        sublabel: "Treasury",
      },
      {
        id: "program",
        label: "Program",
        value: `$${input.programBudgetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        sublabel: "Budget deployed",
      },
      {
        id: "artists",
        label: "Artists",
        value: String(input.artistCount),
        sublabel: "Recipients",
      },
      {
        id: "plays",
        label: "Plays",
        value: input.playCount.toLocaleString(),
        sublabel: "Verified",
      },
      {
        id: "impact",
        label: "Est. impact",
        value: estImpact.toLocaleString(),
        sublabel: "Listener reach",
      },
    ],
  };
}

export async function buildCommunitySurface(
  userId: string | null,
  slug: string,
): Promise<CommunitySurface | null> {
  const community = getCommunityBySlug(slug);
  if (!community) return null;

  const [treasury, connectors, navidrome] = await Promise.all([
    getTreasurySnapshot().catch(() => ({
      balanceUsd: 0,
      obligationsUsd: 0,
      availableUsd: 0,
      canSettleGlobally: false,
    })),
    getConnectorLiveStatuses().catch(() => []),
    getNavidromeSyncStatus().catch(() => null),
  ]);

  const install = userId ? await getInstall(userId, slug) : null;
  const programs = userId ? await listProgramsForCommunity(userId, slug) : [];

  let authorizedUsd = 0;
  let settledUsd = 0;
  let playCount = 0;
  let artistCount = 0;
  const missionIds = programs.map((p) => p.missionId).filter(Boolean) as string[];

  for (const missionId of missionIds) {
    const summary = await getAuthorizationSummary({ missionId });
    authorizedUsd += summary.authorizedUsd + summary.pendingFundingUsd;
    settledUsd += summary.settledUsd + summary.claimableUsd;
    playCount += summary.count;
    const artists = new Set(summary.authorizations.map((a) => a.payeeKey));
    artistCount += artists.size;
  }

  const programBudgetUsd = programs.reduce((s, p) => s + p.budgetUsd, 0);

  const connectorStatus = community.connectors.map((id) => {
    const live = connectors.find((c) => c.id === id);
    return {
      id,
      health: live?.health ?? "unknown",
      label: live?.label ?? id,
    };
  });

  const timeline =
    userId && install?.ecosystemId
      ? await buildLiveTimeline(userId, install.ecosystemId)
      : userId
        ? await buildLiveTimeline(userId)
        : [];

  return {
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    kind: community.kind,
    upstream: community.upstream,
    doctrine: community.doctrine,
    connectors: community.connectors,
    accent: community.accent,
    installed: Boolean(install),
    install,
    programs,
    health: {
      treasuryUsd: treasury.balanceUsd,
      obligationsUsd: treasury.obligationsUsd,
      connectorStatus,
      scrobbleBridge: Boolean(navidrome?.cursor),
    },
    impact: buildImpactChain({
      treasuryUsd: treasury.balanceUsd,
      programBudgetUsd,
      authorizedUsd,
      settledUsd,
      playCount,
      artistCount,
    }),
    timeline: timeline.slice(0, 20).map((t) => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      detail: t.detail,
      createdAt: t.createdAt,
    })),
  };
}

export async function listCommunitySummaries(userId: string | null) {
  const { COMMUNITY_CATALOG } = await import("@/lib/communities/catalog");
  const installs = userId
    ? await prisma.resolveCommunityInstall.findMany({ where: { userId } })
    : [];
  const installSet = new Set(installs.map((i) => i.communitySlug));

  return COMMUNITY_CATALOG.map((c) => ({
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    kind: c.kind,
    accent: c.accent,
    featured: c.featured,
    installCta: c.installCta,
    installed: installSet.has(c.slug),
  }));
}
