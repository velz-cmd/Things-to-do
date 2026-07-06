import { prisma } from "@/lib/db";
import { COHORT_POOL_SIZE } from "@/lib/earn/discover-eligibility";
import { payeeDisplayLabel } from "@/lib/ledger/labels";
import type { PoolBatchPayeeRow } from "@/lib/capital/pool-checkpoint-types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Queued creators for the next checkpoint batch — up to cohort size, variable owed amounts. */
export async function getNextBatchPayees(
  missionId: string | null | undefined,
  limit = COHORT_POOL_SIZE,
): Promise<PoolBatchPayeeRow[]> {
  if (!missionId) return [];

  const rows = await prisma.paymentAuthorization.findMany({
    where: {
      missionId,
      status: { in: ["authorized", "pending_funding", "claimable"] },
      amountUsd: { gt: 0 },
    },
    orderBy: { amountUsd: "desc" },
    take: limit * 3,
    select: {
      payeeKeyType: true,
      payeeKey: true,
      amountUsd: true,
    },
  });

  const byPayee = new Map<string, PoolBatchPayeeRow>();
  for (const row of rows) {
    const key = `${row.payeeKeyType}:${row.payeeKey}`;
    const existing = byPayee.get(key);
    if (existing) {
      existing.owedUsd = round(existing.owedUsd + row.amountUsd);
    } else {
      byPayee.set(key, {
        label: payeeDisplayLabel(row.payeeKeyType, row.payeeKey),
        owedUsd: round(row.amountUsd),
        payeeKey: row.payeeKey,
        payeeKeyType: row.payeeKeyType,
      });
    }
  }

  return [...byPayee.values()]
    .sort((a, b) => b.owedUsd - a.owedUsd)
    .slice(0, limit);
}
