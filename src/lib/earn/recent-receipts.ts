import { prisma } from "@/lib/db";
import type { PayeeIdentity } from "@/lib/earn/summary";

export type EarnReceiptSnippet = {
  id: string;
  amountUsd: number;
  status: string;
  contextLabel: string | null;
  connectorId: string;
  eventType: string;
  createdAt: string;
  receiptHref: string;
};

export async function listRecentEarnReceipts(
  identities: PayeeIdentity[],
  limit = 5,
): Promise<EarnReceiptSnippet[]> {
  if (!process.env.DATABASE_URL || identities.length === 0) {
    return [];
  }

  const rows = await prisma.paymentAuthorization.findMany({
    where: {
      OR: identities.map((i) => ({
        payeeKeyType: i.payeeKeyType,
        payeeKey: i.payeeKey,
      })),
      status: { in: ["settled", "claimable", "claimed", "authorized"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      amountUsd: true,
      status: true,
      contextLabel: true,
      connectorId: true,
      eventType: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    amountUsd: Math.round(row.amountUsd * 100) / 100,
    status: row.status,
    contextLabel: row.contextLabel,
    connectorId: row.connectorId,
    eventType: row.eventType,
    createdAt: row.createdAt.toISOString(),
    receiptHref: `/receipt/${row.id}`,
  }));
}
