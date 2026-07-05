import { prisma } from "@/lib/db";

/**
 * App-wallet fund_program rows are ledger-complete at write time.
 * Reconcile legacy `pending_sync` → `completed` so Capital activity stays accurate.
 */
export async function reconcilePendingFundTransactions(limit = 64) {
  const rows = await prisma.walletTransaction.findMany({
    where: {
      type: "fund_program",
      method: "arc_usdc",
      status: { in: ["pending_sync", "pending", "syncing"] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  if (rows.length === 0) {
    return { reconciled: 0 };
  }

  const result = await prisma.walletTransaction.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "completed" },
  });

  return { reconciled: result.count };
}
