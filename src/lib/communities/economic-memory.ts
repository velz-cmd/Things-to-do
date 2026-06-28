import { prisma } from "@/lib/db";
import { listTimeline } from "@/lib/mission/server/timeline";

export type EconomicMemoryEntry = {
  id: string;
  phase: "fund" | "authorize" | "deploy" | "outcome" | "observe";
  title: string;
  detail: string | null;
  amountUsd: number | null;
  at: string;
};

/** Funding → outcome over time — community economic memory */
export async function buildEconomicMemory(input: {
  userId: string;
  ecosystemId: string | null;
  missionIds: string[];
  limit?: number;
}): Promise<EconomicMemoryEntry[]> {
  const entries: EconomicMemoryEntry[] = [];

  const stored = await listTimeline(input.userId, {
    ecosystemId: input.ecosystemId ?? undefined,
    limit: 30,
  });

  for (const ev of stored) {
    let phase: EconomicMemoryEntry["phase"] = "observe";
    if (ev.eventType.includes("install")) phase = "fund";
    else if (ev.eventType.includes("deploy") || ev.eventType.includes("settlement")) phase = "deploy";
    else if (ev.eventType.includes("funding") || ev.eventType.includes("treasury")) phase = "fund";
    else if (ev.eventType.includes("authorization") || ev.eventType.includes("scrobble")) phase = "authorize";
    else if (ev.eventType.includes("knowledge") || ev.eventType.includes("outcome")) phase = "outcome";

    const amountMatch = ev.detail?.match(/\$([0-9,.]+)/);
    entries.push({
      id: ev.id,
      phase,
      title: ev.title,
      detail: ev.detail,
      amountUsd: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null,
      at: ev.createdAt,
    });
  }

  if (input.missionIds.length) {
    const authorizations = await prisma.paymentAuthorization.findMany({
      where: { missionId: { in: input.missionIds } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amountUsd: true,
        status: true,
        contextLabel: true,
        payeeKey: true,
        createdAt: true,
        eventType: true,
      },
    });

    for (const a of authorizations) {
      entries.push({
        id: `auth-${a.id}`,
        phase: a.status === "settled" ? "outcome" : "authorize",
        title: a.contextLabel ?? a.eventType,
        detail: `${a.payeeKey} · $${a.amountUsd.toFixed(4)} · ${a.status}`,
        amountUsd: a.amountUsd,
        at: a.createdAt.toISOString(),
      });
    }

    const settlements = await prisma.missionSettlement.findMany({
      where: { missionId: { in: input.missionIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const s of settlements) {
      entries.push({
        id: `settle-${s.id}`,
        phase: s.status === "SETTLED" ? "outcome" : "deploy",
        title: `Arc settlement · ${s.status}`,
        detail: `$${s.treasuryAmount.toFixed(2)} USDC batch`,
        amountUsd: s.treasuryAmount,
        at: s.createdAt.toISOString(),
      });
    }
  }

  const deduped = new Map<string, EconomicMemoryEntry>();
  for (const e of entries) {
    if (!deduped.has(e.id)) deduped.set(e.id, e);
  }

  return [...deduped.values()]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, input.limit ?? 25);
}
