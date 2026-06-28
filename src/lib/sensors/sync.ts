import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { scanDocsMergedObservations } from "@/lib/sensors/github-docs";
import { scanSecurityAdvisoryObservations } from "@/lib/sensors/github-security";
import { scanCitationObservations } from "@/lib/sensors/openalex-citations";
import { ingestObservationPipeline } from "@/lib/sensors/pipeline";
import { resolveSensorProgramContext } from "@/lib/sensors/program-context";
import { COMMUNITY_GITHUB_TARGETS } from "@/lib/sensors/targets";
import type { Observation } from "@/lib/domain/observation";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";

export type SensorSyncResult = {
  communitySlug: string;
  observations: number;
  ingested: number;
  skipped: number;
  missionId: string | null;
  eventTypes: string[];
  reposScanned: string[];
  live: boolean;
};

async function recordSensorTimeline(input: {
  communitySlug: string;
  ingested: number;
  eventTypes: string[];
  userId?: string;
  missionId?: string | null;
}) {
  if (input.ingested <= 0 || !input.userId) return;
  try {
    await recordTimelineEvent({
      userId: input.userId,
      missionId: input.missionId ?? undefined,
      eventType: "sensor_sync",
      title: `Sensor sync · ${input.communitySlug}`,
      detail: `${input.ingested} authorization(s) from ${input.eventTypes.join(", ")}`,
      severity: "info",
      metadata: { communitySlug: input.communitySlug, eventTypes: input.eventTypes },
    });
  } catch {
    /* non-fatal */
  }
}

/** Sync GitHub docs + security sensors for oss communities (react, linux). */
export async function syncGithubCommunitySensors(input: {
  communitySlug: string;
  missionId?: string;
  founderUserId?: string;
  includeSecurity?: boolean;
}): Promise<SensorSyncResult> {
  const community = getCommunityBySlug(input.communitySlug);
  const targets = COMMUNITY_GITHUB_TARGETS[input.communitySlug] ?? [];
  const eventTypes: string[] = [];
  const reposScanned: string[] = [];
  let allObservations: Observation[] = [];

  if (!community || !targets.length) {
    return {
      communitySlug: input.communitySlug,
      observations: 0,
      ingested: 0,
      skipped: 0,
      missionId: null,
      eventTypes: [],
      reposScanned: [],
      live: false,
    };
  }

  const docsProgram = await resolveSensorProgramContext({
    communitySlug: input.communitySlug,
    templateId: "docs-bounty",
    missionIdOverride: input.missionId,
    founderUserId: input.founderUserId,
  });

  const securityProgram = await resolveSensorProgramContext({
    communitySlug: input.communitySlug,
    templateId: "security-fund",
    missionIdOverride: input.missionId,
    founderUserId: input.founderUserId,
  });

  for (const t of targets) {
    reposScanned.push(`${t.owner}/${t.repo}`);

    if (docsProgram) {
      const docsObs = await scanDocsMergedObservations({
        owner: t.owner,
        repo: t.repo,
        program: docsProgram,
      });
      allObservations.push(...docsObs);
      if (docsObs.length) eventTypes.push("docs.merged");
    }

    if (input.includeSecurity !== false && securityProgram) {
      const secObs = await scanSecurityAdvisoryObservations({
        owner: t.owner,
        repo: t.repo,
        program: securityProgram,
      });
      allObservations.push(...secObs);
      if (secObs.length) eventTypes.push("security.advisory");
    }
  }

  let ingested = 0;
  let skipped = 0;
  let missionId: string | null = null;

  if (docsProgram && allObservations.some((o) => o.policyId === "docs-bounty")) {
    const docsOnly = allObservations.filter((o) => o.policyId === "docs-bounty");
    const result = await ingestObservationPipeline({
      observations: docsOnly,
      program: docsProgram,
      founderUserId: input.founderUserId,
    });
    ingested += result.ingested;
    skipped += result.skipped;
    missionId = result.missionId;
  }

  if (securityProgram && allObservations.some((o) => o.policyId === "security-fund")) {
    const secOnly = allObservations.filter((o) => o.policyId === "security-fund");
    const result = await ingestObservationPipeline({
      observations: secOnly,
      program: securityProgram,
      founderUserId: input.founderUserId,
    });
    ingested += result.ingested;
    skipped += result.skipped;
    missionId = missionId ?? result.missionId;
  }

  const uniqueEventTypes = [...new Set(eventTypes)];
  if (ingested > 0) {
    await recordSensorTimeline({
      communitySlug: input.communitySlug,
      ingested,
      eventTypes: uniqueEventTypes,
      userId: input.founderUserId,
      missionId,
    });
  }

  return {
    communitySlug: input.communitySlug,
    observations: allObservations.length,
    ingested,
    skipped,
    missionId,
    eventTypes: uniqueEventTypes,
    reposScanned,
    live: ingested > 0 || allObservations.length > 0,
  };
}

/** Sync OpenAlex citation sensor for open-research community (RFB #2). */
export async function syncOpenAlexCommunitySensors(input: {
  communitySlug?: string;
  missionId?: string;
  founderUserId?: string;
}): Promise<SensorSyncResult> {
  const communitySlug = input.communitySlug ?? "open-research";
  const program = await resolveSensorProgramContext({
    communitySlug,
    templateId: "citation-toll",
    missionIdOverride: input.missionId,
    founderUserId: input.founderUserId,
  });

  if (!program) {
    return {
      communitySlug,
      observations: 0,
      ingested: 0,
      skipped: 0,
      missionId: null,
      eventTypes: [],
      reposScanned: [],
      live: false,
    };
  }

  const observations = await scanCitationObservations({ program });
  const result = await ingestObservationPipeline({
    observations,
    program,
    founderUserId: input.founderUserId,
  });

  if (result.ingested > 0 && input.founderUserId) {
    await recordTimelineEvent({
      userId: input.founderUserId,
      missionId: result.missionId,
      eventType: "sensor_sync",
      title: `Citation sensor · ${communitySlug}`,
      detail: `${result.ingested} citation authorization(s) from OpenAlex`,
      severity: "info",
      metadata: { communitySlug, eventTypes: ["citation.verified"] },
    }).catch(() => undefined);
  }

  return {
    communitySlug,
    observations: observations.length,
    ingested: result.ingested,
    skipped: result.skipped,
    missionId: result.missionId,
    eventTypes: observations.length ? ["citation.verified"] : [],
    reposScanned: [],
    live: result.ingested > 0 || observations.length > 0,
  };
}

/** Count ledger rows proving sensor is live for a community slug. */
export async function communityHasLiveSensorEvents(communitySlug: string): Promise<boolean> {
  const community = getCommunityBySlug(communitySlug);
  if (!community) return false;

  const eventTypes =
    communitySlug === "open-research"
      ? ["citation.verified"]
      : ["docs.merged", "security.advisory"];

  const count = await prisma.paymentAuthorization
    .count({
      where: {
        eventType: { in: eventTypes },
        OR: [
          { connectorId: { in: community.connectors } },
          { missionId: { contains: communitySlug } },
        ],
      },
    })
    .catch(() => 0);

  return count > 0;
}
