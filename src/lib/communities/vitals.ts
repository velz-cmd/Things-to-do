import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { getConnectorLiveStatuses, type ConnectorLiveStatus } from "@/lib/connectors/live-stats";
import type { CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";
import {
  buildObserveNarrative,
  computeCommunityHealth,
  formatFundingLabel,
  topBuildersFromAuths,
  type CommunityBuilderVital,
} from "@/lib/communities/vitals-compute";

export type { CommunityBuilderVital } from "@/lib/communities/vitals-compute";
export { buildObserveNarrative, computeCommunityHealth } from "@/lib/communities/vitals-compute";

export type CommunityVitals = {
  healthPct: number | null;
  healthLabel: string;
  fundingTotalUsd: number;
  fundingLabel: string;
  openWorkCount: number;
  programCount: number;
  topBuilders: CommunityBuilderVital[];
  sensor: {
    gated: boolean;
    live: boolean;
    ready: boolean;
    label: string;
  };
  observeNarrative: string;
  hasLiveData: boolean;
};

const OPEN_WORK_STATUSES = new Set(["authorized", "pending_funding"]);

type SlugAggregate = {
  programCount: number;
  fundingTotalUsd: number;
  missionIds: string[];
  openWorkCount: number;
  topBuilders: CommunityBuilderVital[];
  connectorAuthUsd: number;
  connectorOpenWork: number;
};

async function loadSlugAggregates(): Promise<Map<string, SlugAggregate>> {
  const bySlug = new Map<string, SlugAggregate>();

  for (const entry of COMMUNITY_CATALOG) {
    bySlug.set(entry.slug, {
      programCount: 0,
      fundingTotalUsd: 0,
      missionIds: [],
      openWorkCount: 0,
      topBuilders: [],
      connectorAuthUsd: 0,
      connectorOpenWork: 0,
    });
  }

  if (!process.env.DATABASE_URL) return bySlug;

  const programs = await prisma.resolveProgram.findMany({
    select: {
      missionId: true,
      budgetUsd: true,
      install: { select: { communitySlug: true } },
    },
  });

  const missionToSlug = new Map<string, string>();
  const allMissionIds: string[] = [];

  for (const p of programs) {
    const slug = p.install?.communitySlug;
    if (!slug) continue;
    const agg = bySlug.get(slug);
    if (!agg) continue;
    agg.programCount += 1;
    agg.fundingTotalUsd += p.budgetUsd;
    if (p.missionId) {
      agg.missionIds.push(p.missionId);
      missionToSlug.set(p.missionId, slug);
      allMissionIds.push(p.missionId);
    }
  }

  const uniqueMissionIds = [...new Set(allMissionIds)];
  const authRows =
    uniqueMissionIds.length > 0
      ? await prisma.paymentAuthorization.findMany({
          where: { missionId: { in: uniqueMissionIds } },
          select: {
            missionId: true,
            payeeKey: true,
            amountUsd: true,
            status: true,
            connectorId: true,
          },
        })
      : [];

  const authsBySlug = new Map<string, Array<{ payeeKey: string; amountUsd: number; status: string }>>();

  for (const a of authRows) {
    const slug = missionToSlug.get(a.missionId);
    if (!slug) continue;
    const agg = bySlug.get(slug);
    if (!agg) continue;
    if (OPEN_WORK_STATUSES.has(a.status)) agg.openWorkCount += 1;
    const list = authsBySlug.get(slug) ?? [];
    list.push({ payeeKey: a.payeeKey, amountUsd: a.amountUsd, status: a.status });
    authsBySlug.set(slug, list);
  }

  const connectorRows = await prisma.paymentAuthorization
    .groupBy({
      by: ["connectorId"],
      _count: { id: true },
      _sum: { amountUsd: true },
      where: { status: { in: [...OPEN_WORK_STATUSES] } },
    })
    .catch(() => []);

  const connectorOpenRows = await prisma.paymentAuthorization
    .groupBy({
      by: ["connectorId"],
      _count: { id: true },
      where: { status: { in: [...OPEN_WORK_STATUSES] } },
    })
    .catch(() => []);

  const authUsdByConnector = new Map(
    connectorRows.map((r) => [r.connectorId, r._sum.amountUsd ?? 0]),
  );
  const openByConnector = new Map(
    connectorOpenRows.map((r) => [r.connectorId, r._count.id]),
  );

  for (const entry of COMMUNITY_CATALOG) {
    const agg = bySlug.get(entry.slug);
    if (!agg) continue;

    for (const connectorId of entry.connectors) {
      agg.connectorAuthUsd += authUsdByConnector.get(connectorId) ?? 0;
      agg.connectorOpenWork += openByConnector.get(connectorId) ?? 0;
    }

    const slugAuths = authsBySlug.get(entry.slug) ?? [];
    agg.topBuilders = topBuildersFromAuths(slugAuths);
  }

  return bySlug;
}

export async function buildCommunityVitals(
  slug: string,
  sensorStatuses: CommunitySensorStatus[],
  connectorStatuses: ConnectorLiveStatus[],
  aggregates: Map<string, SlugAggregate>,
): Promise<CommunityVitals> {
  const community = COMMUNITY_CATALOG.find((c) => c.slug === slug);
  const sensor =
    sensorStatuses.find((s) => s.slug === slug) ?? {
      slug,
      sensorGated: false,
      sensorLive: true,
      sensorReady: true,
      message: "Observing",
    };

  if (!community) {
    return {
      healthPct: null,
      healthLabel: "Unknown",
      fundingTotalUsd: 0,
      fundingLabel: "Not synced",
      openWorkCount: 0,
      programCount: 0,
      topBuilders: [],
      sensor: {
        gated: sensor.sensorGated,
        live: sensor.sensorLive,
        ready: sensor.sensorReady,
        label: sensor.message,
      },
      observeNarrative: "RESOLVE will observe upstream signals when installed.",
      hasLiveData: false,
    };
  }

  const agg = aggregates.get(slug) ?? {
    programCount: 0,
    fundingTotalUsd: 0,
    missionIds: [],
    openWorkCount: 0,
    topBuilders: [],
    connectorAuthUsd: 0,
    connectorOpenWork: 0,
  };

  const programCount = agg.programCount;
  const fundingTotalUsd =
    agg.fundingTotalUsd > 0 ? agg.fundingTotalUsd : agg.connectorAuthUsd;
  const openWorkCount =
    agg.openWorkCount > 0 ? agg.openWorkCount : agg.connectorOpenWork;
  const hasLiveData =
    programCount > 0 ||
    openWorkCount > 0 ||
    fundingTotalUsd > 0 ||
    agg.topBuilders.length > 0 ||
    (sensor.sensorGated ? sensor.sensorLive : false);

  const { healthPct, healthLabel } = computeCommunityHealth({
    connectors: community.connectors,
    connectorStatuses,
    sensor,
    hasPrograms: programCount > 0,
    hasOpenWork: openWorkCount > 0,
  });

  return {
    healthPct,
    healthLabel,
    fundingTotalUsd: Math.round(fundingTotalUsd * 100) / 100,
    fundingLabel: formatFundingLabel(fundingTotalUsd, hasLiveData),
    openWorkCount,
    programCount,
    topBuilders: agg.topBuilders,
    sensor: {
      gated: sensor.sensorGated,
      live: sensor.sensorLive,
      ready: sensor.sensorReady,
      label: sensor.sensorGated
        ? sensor.sensorLive
          ? "Sensor live"
          : sensor.sensorReady
            ? "Awaiting sync"
            : "Awaiting config"
        : "Observing",
    },
    observeNarrative: buildObserveNarrative(community),
    hasLiveData,
  };
}

export async function listCommunityVitals(
  sensorStatuses: CommunitySensorStatus[],
): Promise<Record<string, CommunityVitals>> {
  const [connectorStatuses, aggregates] = await Promise.all([
    getConnectorLiveStatuses().catch(() => [] as ConnectorLiveStatus[]),
    loadSlugAggregates(),
  ]);

  const out: Record<string, CommunityVitals> = {};
  for (const entry of COMMUNITY_CATALOG) {
    out[entry.slug] = await buildCommunityVitals(
      entry.slug,
      sensorStatuses,
      connectorStatuses,
      aggregates,
    );
  }
  return out;
}
