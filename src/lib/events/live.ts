import { prisma } from "@/lib/db";
import { domainLabel, type ValueDomain } from "@/lib/workspace/domains";
import { eventTypeLabel, explainRecognition } from "@/lib/workspace/events";
import { entityIdToPath, payeeToEntityId } from "@/lib/entity/paths";

export type LiveEventItem = {
  id: string;
  kind: "authorization" | "timeline";
  title: string;
  detail: string;
  amountUsd?: number;
  status?: string;
  connectorId?: string;
  domain?: string;
  missionId?: string;
  communitySlug?: string;
  payeeKey?: string;
  payeeKeyType?: string;
  entityId?: string;
  entityPath?: string;
  at: string;
  evidence: string;
};

export type LiveEventsPayload = {
  ok: true;
  live: boolean;
  total: number;
  events: LiveEventItem[];
  filters: {
    domain: string | null;
    community: string | null;
    mission: string | null;
    status: string | null;
  };
  updatedAt: string;
};

const DOMAIN_CONNECTORS: Record<ValueDomain, string[]> = {
  code: ["github"],
  music: ["navidrome", "listenbrainz", "musicbrainz"],
  video: ["peertube", "owncast", "jellyfin"],
  research: ["openalex"],
  photos: [],
  documentation: ["github"],
  feeds: ["rsshub", "mastodon"],
  other: [],
};

function payeeNodeId(payeeKey: string, payeeKeyType: string) {
  return payeeToEntityId(payeeKey, payeeKeyType);
}

export async function buildLiveEvents(input: {
  limit?: number;
  domain?: string | null;
  communitySlug?: string | null;
  missionId?: string | null;
  status?: string | null;
  userId?: string | null;
}): Promise<LiveEventsPayload> {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100);

  let missionIds: string[] | undefined;
  if (input.missionId) {
    missionIds = [input.missionId];
  } else if (input.communitySlug && input.userId) {
    const installs = await prisma.resolveCommunityInstall.findMany({
      where: { userId: input.userId, communitySlug: input.communitySlug },
      select: { id: true },
    });
    const programs = await prisma.resolveProgram.findMany({
      where: { installId: { in: installs.map((i) => i.id) } },
      select: { missionId: true, install: { select: { communitySlug: true } } },
    });
    missionIds = programs.map((p) => p.missionId).filter((id): id is string => Boolean(id));
  } else if (input.userId) {
    const programs = await prisma.resolveProgram.findMany({
      where: { userId: input.userId, missionId: { not: null } },
      select: { missionId: true, install: { select: { communitySlug: true } } },
    });
    missionIds = programs.map((p) => p.missionId!).filter(Boolean);
  }

  const connectorFilter =
    input.domain && input.domain !== "all"
      ? DOMAIN_CONNECTORS[input.domain as ValueDomain] ?? []
      : undefined;

  const authWhere: Record<string, unknown> = {};
  if (missionIds?.length) authWhere.missionId = { in: missionIds };
  if (input.status) authWhere.status = input.status;
  if (connectorFilter?.length) authWhere.connectorId = { in: connectorFilter };

  const [authRows, timelineRows, programMeta] = await Promise.all([
    prisma.paymentAuthorization
      .findMany({
        where: authWhere,
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          connectorId: true,
          eventType: true,
          amountUsd: true,
          status: true,
          contextLabel: true,
          payeeKey: true,
          payeeKeyType: true,
          confidence: true,
          missionId: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
    input.communitySlug && input.userId
      ? prisma.resolveTimelineEvent
          .findMany({
            where: { userId: input.userId },
            orderBy: { createdAt: "desc" },
            take: Math.min(limit, 12),
            select: {
              id: true,
              eventType: true,
              title: true,
              detail: true,
              missionId: true,
              severity: true,
              createdAt: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
    missionIds?.length
      ? prisma.resolveProgram.findMany({
          where: { missionId: { in: missionIds } },
          select: { missionId: true, install: { select: { communitySlug: true } } },
        })
      : Promise.resolve([]),
  ]);

  const missionToCommunity = new Map<string, string>();
  for (const p of programMeta) {
    if (p.missionId && p.install?.communitySlug) {
      missionToCommunity.set(p.missionId, p.install.communitySlug);
    }
  }

  const events: LiveEventItem[] = [];

  for (const r of authRows) {
    const domain = domainLabel(r.connectorId);
    const context = r.contextLabel ?? r.payeeKey;
    const entityId = payeeNodeId(r.payeeKey, r.payeeKeyType);
    events.push({
      id: `auth-${r.id}`,
      kind: "authorization",
      title: eventTypeLabel(r.eventType),
      detail: context,
      amountUsd: r.amountUsd,
      status: r.status,
      connectorId: r.connectorId,
      domain,
      missionId: r.missionId,
      communitySlug: missionToCommunity.get(r.missionId) ?? undefined,
      payeeKey: r.payeeKey,
      payeeKeyType: r.payeeKeyType,
      entityId,
      entityPath: entityIdToPath(entityId) ?? undefined,
      at: r.updatedAt.toISOString(),
      evidence: explainRecognition({
        eventType: r.eventType,
        domain,
        context,
        status: r.status,
        amountUsd: r.amountUsd,
        confidence: r.confidence,
      }),
    });
  }

  for (const t of timelineRows) {
    if (input.missionId && t.missionId !== input.missionId) continue;
    events.push({
      id: `tl-${t.id}`,
      kind: "timeline",
      title: t.title,
      detail: t.detail ?? t.eventType,
      missionId: t.missionId ?? undefined,
      communitySlug: input.communitySlug ?? undefined,
      at: t.createdAt.toISOString(),
      evidence: `Community event · ${t.eventType}${t.severity !== "info" ? ` · ${t.severity}` : ""}`,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    ok: true,
    live: events.length > 0,
    total: events.length,
    events: events.slice(0, limit),
    filters: {
      domain: input.domain ?? null,
      community: input.communitySlug ?? null,
      mission: input.missionId ?? null,
      status: input.status ?? null,
    },
    updatedAt: new Date().toISOString(),
  };
}

export type PendingAuthorizationRow = {
  id: string;
  missionId: string;
  programName: string;
  communitySlug: string;
  payeeKey: string;
  payeeKeyType: string;
  amountUsd: number;
  status: string;
  connectorId: string;
  contextLabel: string | null;
  updatedAt: string;
  entityPath?: string;
};

/** Program-scoped authorizations awaiting funding or settlement — for Capital. */
export async function getPendingAuthorizationsForUser(userId: string, limit = 24) {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId, missionId: { not: null } },
    include: { install: { select: { communitySlug: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const missionMap = new Map(
    programs.map((p) => [
      p.missionId!,
      { name: p.name, communitySlug: p.install?.communitySlug ?? "unknown" },
    ]),
  );
  const missionIds = [...missionMap.keys()];
  if (!missionIds.length) return [] as PendingAuthorizationRow[];

  const rows = await prisma.paymentAuthorization.findMany({
    where: {
      missionId: { in: missionIds },
      status: { in: ["authorized", "pending_funding", "claimable"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((r) => {
    const meta = missionMap.get(r.missionId)!;
    const entityId = payeeToEntityId(r.payeeKey, r.payeeKeyType);
    return {
      id: r.id,
      missionId: r.missionId,
      programName: meta.name,
      communitySlug: meta.communitySlug,
      payeeKey: r.payeeKey,
      payeeKeyType: r.payeeKeyType,
      amountUsd: r.amountUsd,
      status: r.status,
      connectorId: r.connectorId,
      contextLabel: r.contextLabel,
      updatedAt: r.updatedAt.toISOString(),
      entityPath: entityIdToPath(entityId) ?? undefined,
    };
  });
}
