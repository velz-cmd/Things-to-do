import { prisma } from "@/lib/db";

export type PersistedAgentResult = {
  serviceId: string;
  summary: string | null;
  occurredAt: string;
};

/**
 * Look up a persisted Agent result by the Discover subject that triggered
 * the purchase (subjectType/subjectId, e.g. a specific Verified Work
 * outcome). evidenceJson is a JSON-stringified free-form field, not a typed
 * column, so this filters recent agent_service authorizations in memory
 * rather than querying into the JSON directly - correct at current volume,
 * and isolated behind this one function if it ever needs an index-backed
 * rewrite.
 */
export async function getAgentResultsForSubject(
  subjectType: string,
  subjectId: string,
): Promise<PersistedAgentResult[]> {
  const byId = await getAgentResultsForSubjects(subjectType, [subjectId]);
  return byId.get(subjectId) ?? [];
}

/** Batched form - one query for every subject in a list, e.g. an entire
 * Verified Work page, instead of one query per row. */
export async function getAgentResultsForSubjects(
  subjectType: string,
  subjectIds: string[],
): Promise<Map<string, PersistedAgentResult[]>> {
  const byId = new Map<string, PersistedAgentResult[]>();
  if (!subjectIds.length) return byId;
  const wanted = new Set(subjectIds);

  const rows = await prisma.paymentAuthorization.findMany({
    where: { payeeKeyType: "agent_service" },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { payeeKey: true, evidenceJson: true, createdAt: true },
  });

  for (const row of rows) {
    if (!row.evidenceJson) continue;
    try {
      const parsed = JSON.parse(row.evidenceJson) as {
        raw?: { result?: unknown; context?: { subjectType?: string; subjectId?: string } };
      };
      const context = parsed.raw?.context;
      if (
        context?.subjectType !== subjectType ||
        !context?.subjectId ||
        !wanted.has(context.subjectId)
      ) {
        continue;
      }
      const result = parsed.raw?.result;
      const summary =
        result && typeof result === "object" && "summary" in result
          ? String((result as { summary?: unknown }).summary ?? "").trim() || null
          : null;
      const entry: PersistedAgentResult = {
        serviceId: row.payeeKey,
        summary,
        occurredAt: row.createdAt.toISOString(),
      };
      const existing = byId.get(context.subjectId) ?? [];
      existing.push(entry);
      byId.set(context.subjectId, existing);
    } catch {
      /* not persisted in the expected shape */
    }
  }
  return byId;
}
