import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getInstall } from "@/lib/communities/installs";
import { listProgramsForCommunity } from "@/lib/communities/programs";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import type { AuthorizationSummary } from "@/lib/authorization/types";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { buildLiveTimeline } from "@/lib/mission/server/timeline";
import { buildCommunityObservatory } from "@/lib/communities/observatory";
import { buildEconomicMemory } from "@/lib/communities/economic-memory";
import { computePlatformFee } from "@/lib/payment/platform-fee";
import { entityIdToPath, payeeToEntityId } from "@/lib/entity/paths";
import {
  noAuthorizationsHint,
  resolveAuthorizationPayee,
} from "@/lib/communities/payee-resolve";
import type {
  CommunityImpactChain,
  CommunitySurface,
  ProgramDeployReadiness,
  ProgramRecord,
} from "./types";

export type BuildCommunitySurfaceOptions = {
  /** Skip observatory, economic memory, timeline, and global treasury fetch. */
  lite?: boolean;
};

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
        sublabel: "Program pools",
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

async function buildProgramDeployReadiness(input: {
  program: ProgramRecord;
  install: Awaited<ReturnType<typeof getInstall>>;
  communityKind: string;
  connectors: string[];
  ownerDepositUsd: number;
  userId: string | null;
  resolveWallets: boolean;
  authorizationSummary?: AuthorizationSummary;
}): Promise<ProgramDeployReadiness> {
  const deployReasons: string[] = [];
  let authorizedForDeployUsd = 0;
  const authorizedForDeploy: Array<{
    payeeKey: string;
    payeeKeyType: string;
    amountUsd: number;
  }> = [];

  if (!input.install) {
    deployReasons.push("Install RESOLVE on this community");
  }

  if (input.program.missionId) {
    const summary =
      input.authorizationSummary ??
      (await getAuthorizationSummary({
        missionId: input.program.missionId,
        connectorId: input.program.rules.connectorId,
      }));
    for (const a of summary.authorizations) {
      if (a.connectorId !== input.program.rules.connectorId) continue;
      if (a.status === "authorized" || a.status === "pending_funding") {
        authorizedForDeployUsd += a.amountUsd;
        authorizedForDeploy.push({
          payeeKey: a.payeeKey,
          payeeKeyType: a.payeeKeyType,
          amountUsd: a.amountUsd,
        });
      }
    }
  }

  if (authorizedForDeploy.length === 0) {
    deployReasons.push(noAuthorizationsHint(input.communityKind, input.connectors));
  }

  const pendingObligationsUsd = Math.round(authorizedForDeployUsd * 10000) / 10000;
  if (pendingObligationsUsd > 0.01) {
    deployReasons.push(
      `$${pendingObligationsUsd.toFixed(2)} owed — fund program pool or deposit before deploy`,
    );
  }

  if (input.program.missionId) {
    const summary =
      input.authorizationSummary ??
      (await getAuthorizationSummary({
        missionId: input.program.missionId,
        connectorId: input.program.rules.connectorId,
      }));
    const programAuthorizedUsd = input.authorizationSummary
      ? authorizedForDeployUsd
      : summary.authorizedUsd + summary.pendingFundingUsd;
    if (
      input.userId &&
      input.ownerDepositUsd < programAuthorizedUsd &&
      programAuthorizedUsd > 0
    ) {
      deployReasons.push("Deposit USDC to your account to cover program obligations");
    }
  }

  let walletMappedCount = 0;
  if (input.resolveWallets && authorizedForDeploy.length > 0) {
    const payees = await Promise.all(
      authorizedForDeploy.map((a) =>
        resolveAuthorizationPayee({
          communityKind: input.communityKind,
          connectors: input.connectors,
          payeeKey: a.payeeKey,
          payeeKeyType: a.payeeKeyType,
        }).catch(() => ({ wallet: null as string | null })),
      ),
    );
    walletMappedCount = payees.filter((payee) => payee.wallet).length;
  }

  return {
    canDeploy: deployReasons.length === 0 && authorizedForDeploy.length > 0,
    authorizedCount: authorizedForDeploy.length,
    authorizedUsd: Math.round(authorizedForDeployUsd * 10000) / 10000,
    pendingObligationsUsd,
    walletMappedCount,
    reasons: deployReasons,
  };
}

function aggregateDeployReadiness(
  programs: ProgramRecord[],
): CommunitySurface["deployReadiness"] {
  const withReadiness = programs.filter((p) => p.deployReadiness);
  const authorizedCount = withReadiness.reduce(
    (s, p) => s + (p.deployReadiness?.authorizedCount ?? 0),
    0,
  );
  const authorizedUsd = withReadiness.reduce(
    (s, p) => s + (p.deployReadiness?.authorizedUsd ?? 0),
    0,
  );
  const pendingObligationsUsd = withReadiness.reduce(
    (s, p) => s + (p.deployReadiness?.pendingObligationsUsd ?? 0),
    0,
  );
  const walletMappedCount = withReadiness.reduce(
    (s, p) => s + (p.deployReadiness?.walletMappedCount ?? 0),
    0,
  );
  const reasons = [...new Set(withReadiness.flatMap((p) => p.deployReadiness?.reasons ?? []))];
  const canDeploy = withReadiness.some((p) => p.deployReadiness?.canDeploy);

  return {
    canDeploy,
    authorizedCount,
    authorizedUsd: Math.round(authorizedUsd * 10000) / 10000,
    pendingObligationsUsd: Math.round(pendingObligationsUsd * 10000) / 10000,
    walletMappedCount,
    reasons,
  };
}

export async function buildCommunitySurface(
  userId: string | null,
  slug: string,
  options?: BuildCommunitySurfaceOptions,
): Promise<CommunitySurface | null> {
  const lite = options?.lite ?? false;
  const community = getCommunityBySlug(slug);
  if (!community) return null;

  const [treasury, connectors, navidrome, ownerProfile] = await Promise.all([
    lite
      ? Promise.resolve({
          balanceUsd: 0,
          obligationsUsd: 0,
          availableUsd: 0,
          canSettleGlobally: false,
        })
      : getTreasurySnapshot().catch(() => ({
          balanceUsd: 0,
          obligationsUsd: 0,
          availableUsd: 0,
          canSettleGlobally: false,
        })),
    lite ? Promise.resolve([]) : getConnectorLiveStatuses().catch(() => []),
    lite ? Promise.resolve(null) : getNavidromeSyncStatus().catch(() => null),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { availableUsd: true } })
      : Promise.resolve(null),
  ]);

  const install = userId ? await getInstall(userId, slug) : null;
  const rawPrograms = userId ? await listProgramsForCommunity(userId, slug) : [];

  let authorizedUsd = 0;
  let settledUsd = 0;
  let playCount = 0;
  let artistCount = 0;
  const missionIds = rawPrograms.map((p) => p.missionId).filter(Boolean) as string[];
  const authorizationPreviews: CommunitySurface["authorizations"] = [];
  if (missionIds.length) {
    const rows = await prisma.paymentAuthorization.findMany({
      where: { missionId: { in: missionIds } },
      orderBy: { createdAt: "desc" },
      take: lite ? 8 : 12,
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

  const missionSummaries = missionIds.length
    ? await Promise.all(missionIds.map((missionId) => getAuthorizationSummary({ missionId })))
    : [];
  const summaryByMissionId = new Map(
    missionSummaries
      .filter((summary) => summary.missionId)
      .map((summary) => [summary.missionId as string, summary]),
  );

  for (const summary of missionSummaries) {
    authorizedUsd += summary.authorizedUsd + summary.pendingFundingUsd;
    settledUsd += summary.settledUsd + summary.claimableUsd;
    playCount += summary.count;
    artistCount += new Set(summary.authorizations.map((a) => a.payeeKey)).size;
  }

  const programBudgetUsd = rawPrograms.reduce((s, p) => s + p.budgetUsd, 0);
  const communityObligationsUsd = authorizedUsd;
  const platformFeeUsd = computePlatformFee(authorizedUsd);
  const ownerDepositUsd = ownerProfile?.availableUsd ?? 0;

  const programs: ProgramRecord[] = await Promise.all(
    rawPrograms.map(async (program) => ({
      ...program,
      deployReadiness: await buildProgramDeployReadiness({
        program,
        install,
        communityKind: community.kind,
        connectors: community.connectors,
        ownerDepositUsd,
        userId,
        resolveWallets: !lite,
        authorizationSummary: program.missionId
          ? summaryByMissionId.get(program.missionId)
          : undefined,
      }),
    })),
  );

  const deployReadiness = aggregateDeployReadiness(programs);

  const connectorStatus = community.connectors.map((id) => {
    const live = connectors.find((c) => c.id === id);
    return {
      id,
      health: live?.health ?? "unknown",
      label: live?.label ?? id,
    };
  });

  const timeline =
    !lite && userId
      ? await buildLiveTimeline(userId, {
          ecosystemId: install?.ecosystemId ?? undefined,
          missionIds,
        })
      : [];

  const observatory =
    !lite && userId && install
      ? await buildCommunityObservatory({
          userId,
          communitySlug: slug,
          ecosystemId: install.ecosystemId,
          programs,
          kind: community.kind,
        })
      : [];

  const economicMemory =
    !lite && userId
      ? await buildEconomicMemory({
          userId,
          ecosystemId: install?.ecosystemId ?? null,
          missionIds,
        })
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
      treasuryUsd: programBudgetUsd,
      obligationsUsd: treasury.obligationsUsd,
      communityObligationsUsd,
      connectorStatus,
      scrobbleBridge: Boolean(navidrome?.cursor),
      lastScrobbleAt: navidrome?.cursor?.lastSubmissionTime ?? null,
    },
    impact: buildImpactChain({
      treasuryUsd: programBudgetUsd,
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
    authorizations: authorizationPreviews.slice(0, lite ? 8 : 12),
    timeline: timeline.slice(0, 20).map((t) => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      detail: t.detail,
      createdAt: t.createdAt,
    })),
    deployReadiness,
  };
}

import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";

export async function listCommunitySummaries(
  userId: string | null,
  options?: {
    sensorStatuses?: import("@/lib/sensors/catalog-visibility").CommunitySensorStatus[];
    fast?: boolean;
  },
) {
  const { COMMUNITY_CATALOG } = await import("@/lib/communities/catalog");
  const { listCommunityVitals } = await import("@/lib/communities/vitals");
  const { getCommunitySensorStatuses } = await import("@/lib/sensors/status");

  const installs = userId
    ? await prisma.resolveCommunityInstall.findMany({ where: { userId } })
    : [];
  const installSet = new Set(installs.map((i) => i.communitySlug));

  const sensorStatuses =
    options?.sensorStatuses ?? (await getCommunitySensorStatuses().catch(() => []));
  const vitalsBySlug = await listCommunityVitals(sensorStatuses, { fast: options?.fast });

  const hubOpsBySlug =
    userId && installSet.size > 0
      ? await import("@/lib/communities/hub-ops-stats").then((m) =>
          m.buildUserHubOpsMap(userId),
        )
      : {};

  return COMMUNITY_CATALOG.map((c) => ({
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    kind: c.kind,
    accent: c.accent,
    featured: c.featured,
    installCta: c.installCta,
    attachShape: c.attachShape,
    upstream: c.upstream,
    installed: installSet.has(c.slug),
    vitals: vitalsBySlug[c.slug],
    hubOps: (hubOpsBySlug[c.slug] ?? null) as CommunityHubOpsStats | null,
  }));
}
