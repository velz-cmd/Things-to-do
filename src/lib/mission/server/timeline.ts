import { prisma } from "@/lib/db";

export type TimelineRecord = {
  id: string;
  ecosystemId: string | null;
  missionId: string | null;
  eventType: string;
  title: string;
  detail: string | null;
  severity: string;
  createdAt: string;
};

export async function recordTimelineEvent(input: {
  userId: string;
  ecosystemId?: string;
  missionId?: string;
  eventType: string;
  title: string;
  detail?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.resolveTimelineEvent.create({
    data: {
      userId: input.userId,
      ecosystemId: input.ecosystemId,
      missionId: input.missionId,
      eventType: input.eventType,
      title: input.title,
      detail: input.detail,
      severity: input.severity ?? "info",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function listTimeline(
  userId: string,
  opts: { ecosystemId?: string; missionId?: string; limit?: number } = {},
): Promise<TimelineRecord[]> {
  const rows = await prisma.resolveTimelineEvent.findMany({
    where: {
      userId,
      ...(opts.ecosystemId ? { ecosystemId: opts.ecosystemId } : {}),
      ...(opts.missionId ? { missionId: opts.missionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 40,
  });
  return rows.map((r) => ({
    id: r.id,
    ecosystemId: r.ecosystemId,
    missionId: r.missionId,
    eventType: r.eventType,
    title: r.title,
    detail: r.detail,
    severity: r.severity,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Enrich timeline with live authorization and settlement events */
export async function buildLiveTimeline(userId: string, ecosystemId?: string) {
  const stored = await listTimeline(userId, { ecosystemId, limit: 30 });

  const authEvents = await prisma.paymentAuthorization.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      missionId: true,
      amountUsd: true,
      status: true,
      contextLabel: true,
      createdAt: true,
    },
  });

  const live: TimelineRecord[] = authEvents.map((a) => ({
    id: `auth-${a.id}`,
    ecosystemId: ecosystemId ?? null,
    missionId: a.missionId,
    eventType: "authorization",
    title: a.contextLabel ?? "Value recognized",
    detail: `$${a.amountUsd.toFixed(2)} · ${a.status}`,
    severity: a.status === "claimable" ? "watch" : "info",
    createdAt: a.createdAt.toISOString(),
  }));

  const merged = [...stored, ...live]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);

  return merged;
}
