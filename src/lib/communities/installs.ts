import { prisma } from "@/lib/db";
import {
  getCommunityBySlug,
  PROGRAM_TEMPLATES,
} from "@/lib/communities/catalog";
import { programTemplatesForCommunity } from "@/lib/connectors/phase3-tracks";
import { ensureSeedEcosystems } from "@/lib/mission/server/ecosystems";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import type { CommunityInstallRecord } from "./types";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toInstallRecord(row: {
  id: string;
  communitySlug: string;
  status: string;
  ecosystemId: string | null;
  connectorIdsJson: string;
  doctrineJson: string | null;
  installedAt: Date;
  updatedAt: Date;
}): CommunityInstallRecord {
  return {
    id: row.id,
    communitySlug: row.communitySlug,
    status: row.status,
    ecosystemId: row.ecosystemId,
    connectorIds: parseJson(row.connectorIdsJson, [] as string[]),
    doctrine: parseJson(row.doctrineJson, null as Record<string, unknown> | null),
    installedAt: row.installedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getInstall(
  userId: string,
  communitySlug: string,
): Promise<CommunityInstallRecord | null> {
  const row = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
  });
  return row ? toInstallRecord(row) : null;
}

export async function listInstalls(userId: string): Promise<CommunityInstallRecord[]> {
  const rows = await prisma.resolveCommunityInstall.findMany({
    where: { userId },
    orderBy: { installedAt: "desc" },
  });
  return rows.map(toInstallRecord);
}

/** Ensure every program template for this community slug exists (idempotent). */
export async function ensureCommunityPrograms(userId: string, communitySlug: string) {
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
    include: { programs: true },
  });
  if (!install) return { created: [] as string[] };

  const existing = new Set(install.programs.map((p) => p.templateId));
  const created: string[] = [];

  for (const templateId of programTemplatesForCommunity(communitySlug)) {
    if (existing.has(templateId)) continue;
    const template = PROGRAM_TEMPLATES[templateId];
    const missionId = `program-${install.id}-${templateId.slice(0, 8)}`;
    await prisma.resolveProgram.create({
      data: {
        userId,
        installId: install.id,
        templateId,
        name: template.name,
        status: "active",
        budgetUsd: template.defaultBudgetUsd,
        rulesJson: JSON.stringify(template.defaultRules),
        missionId,
        metadataJson: JSON.stringify({ communitySlug }),
      },
    });
    created.push(templateId);
  }

  if (created.length > 0) {
    const primary = install.programs[0] ?? (await prisma.resolveProgram.findFirst({
      where: { installId: install.id },
      orderBy: { createdAt: "asc" },
    }));
    if (primary?.missionId) {
      const community = getCommunityBySlug(communitySlug);
      await prisma.resolveCommunityInstall.update({
        where: { id: install.id },
        data: {
          doctrineJson: JSON.stringify({
            text: community?.doctrine,
            attachShape: community?.attachShape,
            upstream: community?.upstream,
            missionId: primary.missionId,
            bridgeEnv: { NAVIDROME_PROGRAM_MISSION_ID: primary.missionId },
          }),
        },
      });
    }
  }

  return { created };
}

export async function installCommunity(userId: string, communitySlug: string) {
  const community = getCommunityBySlug(communitySlug);
  if (!community) {
    return { ok: false as const, error: "Community not found" };
  }

  const existing = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug } },
    include: { programs: true },
  });
  if (existing) {
    await ensureCommunityPrograms(userId, communitySlug);
    const programs = await prisma.resolveProgram.findMany({
      where: { installId: existing.id },
      orderBy: { createdAt: "asc" },
    });
    return {
      ok: true as const,
      install: toInstallRecord(existing),
      programs,
      alreadyInstalled: true,
    };
  }

  await ensureSeedEcosystems(userId);
  let ecosystem = await prisma.resolveEcosystem.findFirst({
    where: { userId, name: community.name },
  });
  if (!ecosystem) {
    ecosystem = await prisma.resolveEcosystem.create({
      data: {
        userId,
        name: community.name,
        kind: community.kind,
        keywordsJson: JSON.stringify(community.keywords),
        reposJson: "[]",
        connectorsJson: JSON.stringify(community.connectors),
      },
    });
  }

  const liveConnectors = (await getConnectorLiveStatuses().catch(() => []))
    .filter((c) => community.connectors.includes(c.id) && c.health === "healthy")
    .map((c) => c.id);

  const install = await prisma.resolveCommunityInstall.create({
    data: {
      userId,
      communitySlug,
      ecosystemId: ecosystem?.id,
      connectorIdsJson: JSON.stringify(
        liveConnectors.length ? liveConnectors : community.connectors,
      ),
      doctrineJson: JSON.stringify({
        text: community.doctrine,
        attachShape: community.attachShape,
        upstream: community.upstream,
      }),
    },
  });

  const templateIds = programTemplatesForCommunity(communitySlug);
  const programs = [];
  let primaryMissionId: string | null = null;

  for (const templateId of templateIds) {
    const template = PROGRAM_TEMPLATES[templateId];
    const missionId = `program-${install.id}-${templateId.slice(0, 8)}`;
    if (!primaryMissionId) primaryMissionId = missionId;
    const program = await prisma.resolveProgram.create({
      data: {
        userId,
        installId: install.id,
        templateId,
        name: template.name,
        status: "active",
        budgetUsd: template.defaultBudgetUsd,
        rulesJson: JSON.stringify(template.defaultRules),
        missionId,
        metadataJson: JSON.stringify({ communitySlug }),
      },
    });
    programs.push(program);
  }

  const defaultTemplate = PROGRAM_TEMPLATES[templateIds[0] ?? "user-centric-royalties"];
  const missionId = primaryMissionId ?? `program-${install.id}-${defaultTemplate.id.slice(0, 8)}`;

  await prisma.resolveCommunityInstall.update({
    where: { id: install.id },
    data: {
      doctrineJson: JSON.stringify({
        text: community.doctrine,
        attachShape: community.attachShape,
        upstream: community.upstream,
        missionId,
        bridgeEnv: {
          NAVIDROME_PROGRAM_MISSION_ID: missionId,
        },
      }),
    },
  });

  await recordTimelineEvent({
    userId,
    ecosystemId: ecosystem?.id ?? undefined,
    eventType: "community_installed",
    title: `RESOLVE installed on ${community.name}`,
    detail: community.doctrine,
    severity: "info",
    metadata: { communitySlug, installId: install.id },
  });

  return {
    ok: true as const,
    install: toInstallRecord(install),
    programs,
    program: programs[0] ?? null,
    alreadyInstalled: false,
  };
}
