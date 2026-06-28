import { prisma } from "@/lib/db";
import { installCommunity } from "@/lib/communities/installs";
import { createProgram } from "@/lib/communities/programs";
import type { ProgramTemplateId } from "@/lib/communities/catalog";
import {
  syncGithubCommunitySensors,
  syncOpenAlexCommunitySensors,
  communityHasLiveSensorEvents,
} from "@/lib/sensors/sync";

const OSS_SLUGS = ["react", "linux"] as const;
const RESEARCH_SLUG = "open-research";

export type BootstrapSensorsResult = {
  ok: boolean;
  userId: string;
  installed: string[];
  programs: Array<{ communitySlug: string; templateId: string; missionId: string | null }>;
  sync: Array<{
    communitySlug: string;
    observations: number;
    ingested: number;
    eventTypes: string[];
    live: boolean;
  }>;
  sensorLive: Record<string, boolean>;
  errors: string[];
};

async function ensureActiveProgram(
  userId: string,
  communitySlug: string,
  templateId: ProgramTemplateId,
) {
  const existing = await prisma.resolveProgram.findFirst({
    where: {
      userId,
      templateId,
      install: { communitySlug },
      status: { in: ["active", "deployed"] },
      missionId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    return {
      communitySlug,
      templateId,
      missionId: existing.missionId,
      created: false,
    };
  }

  const created = await createProgram(userId, communitySlug, { templateId });
  if (!created.ok) {
    return { communitySlug, templateId, missionId: null, created: false, error: created.error };
  }

  await prisma.resolveProgram.update({
    where: { id: created.program.id },
    data: { status: "active" },
  });

  return {
    communitySlug,
    templateId,
    missionId: created.program.missionId,
    created: true,
  };
}

/** Install communities, activate RFB programs, run sensor sync — production bootstrap. */
export async function bootstrapProductionSensors(input?: {
  userId?: string;
}): Promise<BootstrapSensorsResult> {
  const errors: string[] = [];
  const installed: string[] = [];
  const programs: BootstrapSensorsResult["programs"] = [];
  const sync: BootstrapSensorsResult["sync"] = [];

  let userId = input?.userId?.trim();
  if (!userId) {
    const founder = await prisma.resolveCommunityInstall.findFirst({
      orderBy: { installedAt: "asc" },
      select: { userId: true },
    });
    userId = founder?.userId ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }))?.id;
  }

  if (!userId) {
    return {
      ok: false,
      userId: "",
      installed,
      programs,
      sync,
      sensorLive: {},
      errors: ["No user found — sign up on production first"],
    };
  }

  for (const slug of [...OSS_SLUGS, RESEARCH_SLUG]) {
    const result = await installCommunity(userId, slug);
    if (!result.ok) {
      errors.push(`${slug}: ${result.error}`);
      continue;
    }
    installed.push(slug);
  }

  for (const slug of OSS_SLUGS) {
    for (const templateId of ["docs-bounty", "security-fund"] as ProgramTemplateId[]) {
      const p = await ensureActiveProgram(userId, slug, templateId);
      if ("error" in p && p.error) errors.push(`${slug}/${templateId}: ${p.error}`);
      else programs.push({ communitySlug: slug, templateId, missionId: p.missionId });
    }
  }

  const citation = await ensureActiveProgram(userId, RESEARCH_SLUG, "citation-toll");
  if ("error" in citation && citation.error) errors.push(`open-research/citation-toll: ${citation.error}`);
  else programs.push({
    communitySlug: RESEARCH_SLUG,
    templateId: "citation-toll",
    missionId: citation.missionId,
  });

  for (const slug of OSS_SLUGS) {
    try {
      const result = await syncGithubCommunitySensors({
        communitySlug: slug,
        founderUserId: userId,
        includeSecurity: true,
      });
      sync.push({
        communitySlug: slug,
        observations: result.observations,
        ingested: result.ingested,
        eventTypes: result.eventTypes,
        live: result.live,
      });
    } catch (e) {
      errors.push(`${slug} sync: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  try {
    const result = await syncOpenAlexCommunitySensors({
      communitySlug: RESEARCH_SLUG,
      founderUserId: userId,
    });
    sync.push({
      communitySlug: RESEARCH_SLUG,
      observations: result.observations,
      ingested: result.ingested,
      eventTypes: result.eventTypes,
      live: result.live,
    });
  } catch (e) {
    errors.push(`open-research sync: ${e instanceof Error ? e.message : "failed"}`);
  }

  const sensorLive: Record<string, boolean> = {};
  for (const slug of [...OSS_SLUGS, RESEARCH_SLUG]) {
    sensorLive[slug] = await communityHasLiveSensorEvents(slug);
  }

  const totalIngested = sync.reduce((s, r) => s + r.ingested, 0);

  return {
    ok: errors.length === 0 || totalIngested > 0,
    userId,
    installed,
    programs,
    sync,
    sensorLive,
    errors,
  };
}
