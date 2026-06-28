import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getInstall } from "@/lib/communities/installs";
import { listProgramsForCommunity } from "@/lib/communities/programs";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { buildLiveTimeline } from "@/lib/mission/server/timeline";
import { buildCommunityObservatory } from "@/lib/communities/observatory";
import { buildEconomicMemory } from "@/lib/communities/economic-memory";
import { computePlatformFee } from "@/lib/payment/platform-fee";
import { resolvePayee } from "@/lib/registry/resolvers";
import { entityIdToPath, payeeToEntityId } from "@/lib/entity/paths";
import type { CommunityImpactChain, CommunitySurface } from "./types";

function buildImpactChain(input: {
  treasuryUsd: number;
  programBudgetUsd: number;
  communityObligationsUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  platformFeeUsd: number;
  playCount: number;
  artistCount: number;
}): CommunityImpactChain {
  const estimatedReach = input.artistCount > 0 ? input.playCount : 0;
  return {
    treasuryUsd: input.treasuryUsd,
    programBudgetUsd: input.programBudgetUsd,
    communityObligationsUsd: input.communityObligationsUsd,
    authorizedUsd: input.authorizedUsd,
    settledUsd: input.settledUsd,
    platformFeeUsd: input.platformFeeUsd,
    playCount: input.playCount,
    artistCount: input.artistCount,
    estimatedReach,
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
        sublabel: "Budget",
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
        sublabel: "Authorized",
      },
      {
        id: "impact",
        label: "Settled",
        value: `$${input.settledUsd.toFixed(2)}`,
        sublabel: input.platformFeeUsd > 0 ? `+$${input.platformFeeUsd.toFixed(2)} platform` : "On Arc",
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
  const authorizationPreviews: CommunitySurface["authorizations"] = [];
  if (missionIds.length) {
    const rows = await prisma.paymentAuthorization.findMany({
      where: { missionId: { in: missionIds } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        payeeKey: true,
        payeeKeyType: true,
        amountUsd: true,
        status: true,
        contextLabel: true,
        createdAt: true,
      },
    });
    for (const a of rows) {
      const entityId = payeeToEntityId(a.payeeKey, a.payeeKeyType);
      authorizationPreviews.push({
        id: a.id,
        payeeKey: a.payeeKey,
        payeeKeyType: a.payeeKeyType,
        entityId,
        entityPath: entityIdToPath(entityId) ?? undefined,
        amountUsd: a.amountUsd,
        status: a.status,
        contextLabel: a.contextLabel,
        createdAt: a.createdAt.toISOString(),
      });
    }
  }

  for (const missionId of missionIds) {
    const summary = await getAuthorizationSummary({ missionId });
    authorizedUsd += summary.authorizedUsd + summary.pendingFundingUsd;
    settledUsd += summary.settledUsd + summary.claimableUsd;
    playCount += summary.count;
    const artists = new Set(summary.authorizations.map((a) => a.payeeKey));
    artistCount += artists.size;
  }

  const programBudgetUsd = programs.reduce((s, p) => s + p.budgetUsd, 0);
  const communityObligationsUsd = authorizedUsd;
  const platformFeeUsd = computePlatformFee(authorizedUsd);

  const connectorStatus = community.connectors.map((id) => {
    const live = connectors.find((c) => c.id === id);
    return {
      id,
      health: live?.health ?? "unknown",
      label: live?.label ?? id,
    };
  });

  const timeline = userId
    ? await buildLiveTimeline(userId, {
        ecosystemId: install?.ecosystemId ?? undefined,
        missionIds,
      })
    : [];

  const observatory =
    userId && install
      ? await buildCommunityObservatory({
          userId,
          communitySlug: slug,
          ecosystemId: install.ecosystemId,
          programs,
          kind: community.kind,
        })
      : [];

  const economicMemory =
    userId
      ? await buildEconomicMemory({
          userId,
          ecosystemId: install?.ecosystemId ?? null,
          missionIds,
        })
      : [];

  let walletMappedCount = 0;
  const authorizedForDeploy: Array<{
    payeeKey: string;
    status: string;
  }> = [];

  for (const missionId of missionIds) {
    const summary = await getAuthorizationSummary({ missionId });
    for (const a of summary.authorizations) {
      if (a.status === "authorized" || a.status === "pending_funding") {
        authorizedForDeploy.push({ payeeKey: a.payeeKey, status: a.status });
      }
    }
  }

  for (const a of authorizedForDeploy) {
    const payee = await resolvePayee({
      platform: "navidrome",
      payload: { exifArtist: a.payeeKey },
    });
    if (payee.wallet) walletMappedCount++;
  }

  const deployReasons: string[] = [];
  if (!install) deployReasons.push("Install RESOLVE on this community");
  if (authorizedForDeploy.length === 0) deployReasons.push("Sync scrobbles via Navidrome bridge");
  if (treasury.availableUsd < authorizedUsd && authorizedUsd > 0) {
    deployReasons.push("Fund treasury to cover obligations");
  }

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
      communityObligationsUsd,
      connectorStatus,
      scrobbleBridge: Boolean(navidrome?.cursor),
      lastScrobbleAt: navidrome?.cursor?.lastSubmissionTime ?? null,
    },
    impact: buildImpactChain({
      treasuryUsd: treasury.balanceUsd,
      programBudgetUsd,
      communityObligationsUsd,
      authorizedUsd,
      settledUsd,
      platformFeeUsd,
      playCount,
      artistCount,
    }),
    observatory,
    economicMemory,
    authorizations: authorizationPreviews.slice(0, 12),
    timeline: timeline.slice(0, 20).map((t) => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      detail: t.detail,
      createdAt: t.createdAt,
    })),
    deployReadiness: {
      canDeploy: deployReasons.length === 0 && authorizedForDeploy.length > 0,
      authorizedCount: authorizedForDeploy.length,
      walletMappedCount,
      reasons: deployReasons,
    },
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
