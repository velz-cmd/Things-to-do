import { prisma } from "@/lib/db";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";
import { computeCommunityVitalsMap, type CommunityVitals } from "@/lib/communities/vitals";

const VITALS_TTL_MS = 15 * 60_000;

export async function refreshAllCommunityVitalsSnapshots(): Promise<number> {
  const sensorStatuses = await getCommunitySensorStatuses().catch(() => []);
  const vitals = await computeCommunityVitalsMap(sensorStatuses, { mode: "ledger" });

  try {
    await Promise.all(
      Object.entries(vitals).map(([slug, payload]) =>
        prisma.communityVitalsSnapshot.upsert({
        where: { slug },
        create: {
          slug,
          payloadJson: JSON.stringify(payload),
          computedAt: new Date(),
        },
        update: {
          payloadJson: JSON.stringify(payload),
          computedAt: new Date(),
        },
      }),
    ),
    );
  } catch (e) {
    if (!isMissingTableError(e) && !isPrismaUnavailableError(e)) throw e;
  }

  return Object.keys(vitals).length;
}

export async function loadCommunityVitalsSnapshots(): Promise<{
  vitals: Record<string, CommunityVitals>;
  stale: boolean;
}> {
  try {
    const rows = await prisma.communityVitalsSnapshot.findMany();
    if (!rows.length) {
      return { vitals: {}, stale: true };
    }

    const newest = rows.reduce(
      (max, r) => (r.computedAt > max ? r.computedAt : max),
      rows[0]!.computedAt,
    );
    const stale = Date.now() - newest.getTime() > VITALS_TTL_MS;

    const vitals: Record<string, CommunityVitals> = {};
    for (const row of rows) {
      try {
        vitals[row.slug] = JSON.parse(row.payloadJson) as CommunityVitals;
      } catch {
        /* skip corrupt row */
      }
    }

    for (const c of COMMUNITY_CATALOG) {
      if (!vitals[c.slug]) {
        vitals[c.slug] = emptyVitals();
      }
    }

    return { vitals, stale };
  } catch (e) {
    if (isMissingTableError(e) || isPrismaUnavailableError(e)) {
      return { vitals: {}, stale: true };
    }
    throw e;
  }
}

function emptyVitals(): CommunityVitals {
  return {
    healthPct: null,
    healthLabel: "Observing",
    fundingTotalUsd: 0,
    fundingLabel: "No verified funding yet",
    openWorkCount: 0,
    programCount: 0,
    topBuilders: [],
    sensor: { gated: true, live: false, ready: false, label: "Observing" },
    observeNarrative: "Loading metrics from your connected sources.",
    hasLiveData: false,
  };
}
