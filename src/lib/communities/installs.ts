import { prisma } from "@/lib/db";
import {
  getCommunityBySlug,
  PROGRAM_TEMPLATES,
  type ProgramTemplateId,
} from "@/lib/communities/catalog";
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
    return {
      ok: true as const,
      install: toInstallRecord(existing),
      programs: existing.programs,
      alreadyInstalled: true,
    };
  }

  await ensureSeedEcosystems(userId);
  const ecosystem = await prisma.resolveEcosystem.findFirst({
    where: { userId, name: community.name },
  });

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

  const template = PROGRAM_TEMPLATES["user-centric-royalties"];
  const program = await prisma.resolveProgram.create({
    data: {
      userId,
      installId: install.id,
      templateId: "user-centric-royalties" satisfies ProgramTemplateId,
      name: template.name,
      status: "active",
      budgetUsd: template.defaultBudgetUsd,
      rulesJson: JSON.stringify(template.defaultRules),
      missionId: `program-${install.id}-royalties`,
      metadataJson: JSON.stringify({ communitySlug }),
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
    program,
    alreadyInstalled: false,
  };
}
