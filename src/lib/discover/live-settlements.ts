import { prisma } from "@/lib/db";
import { canonicalOutcomeHref } from "@/lib/discover/receipt-links";
import { explorerTxUrl } from "@/lib/settlement/arc-config";

export type LiveSettlementRow = {
  id: string;
  kind: "fund" | "authorization" | "settlement";
  title: string;
  amountUsd: number;
  status: string;
  communitySlug?: string;
  communityName?: string;
  connectorLabel?: string;
  receiptHref?: string;
  explorerUrl?: string | null;
  at: string;
  poolBalanceUsd?: number;
  contributorCount?: number;
  funderCount?: number;
  payeeCategory?: string;
  sourcedHook?: string;
  subline?: string;
};

export type LiveSettlementsPayload = {
  ok: true;
  live: boolean;
  rows: LiveSettlementRow[];
  updatedAt: string;
};

type ConfirmedSettlementRecord = {
  receipt_id: string;
  public_reference: string;
  total_micro_usdc: bigint;
  community_slug: string | null;
  issued_at: Date;
  tx_hash: string;
  chain_id: number;
  from_address: string;
  to_address: string;
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

/**
 * Public settlement activity is sourced only from a receipt linked to a
 * confirmed chain transaction. Authorisations, stake ledger rows, submitted
 * transactions, and legacy mission settlements do not satisfy this contract.
 */
export async function buildLiveSettlements(limit = 12): Promise<LiveSettlementsPayload> {
  const take = Math.min(Math.max(Math.trunc(limit), 1), 24);
  const updatedAt = new Date().toISOString();

  if (!process.env.DATABASE_URL) {
    return { ok: true, live: false, rows: [], updatedAt };
  }

  const records = await prisma.$queryRaw<ConfirmedSettlementRecord[]>`
    SELECT
      r.id AS receipt_id,
      r."publicReference" AS public_reference,
      r."totalUsdcMicro" AS total_micro_usdc,
      r."communitySlug" AS community_slug,
      r."issuedAt" AS issued_at,
      t."txHash" AS tx_hash,
      t."chainId" AS chain_id,
      t."fromAddress" AS from_address,
      t."toAddress" AS to_address
    FROM "Receipt" r
    INNER JOIN "ChainTransaction" t
      ON t.id = r."chainTransactionId"
    WHERE t.status = 'confirmed'
      AND t."txHash" IS NOT NULL
      AND t."confirmedAt" IS NOT NULL
      AND t."fromAddress" IS NOT NULL
      AND t."toAddress" IS NOT NULL
      AND t."amountUsdcMicro" IS NOT NULL
    ORDER BY r."issuedAt" DESC
    LIMIT ${take}
  `;

  const rows = records.map<LiveSettlementRow>((record) => {
    const amountUsd = Number(record.total_micro_usdc) / 1_000_000;
    return {
      id: `receipt-${record.receipt_id}`,
      kind: "settlement",
      title: `$${amountUsd.toFixed(2)} USDC confirmed on Arc`,
      subline: `${shortAddress(record.from_address)} to ${shortAddress(record.to_address)} / chain ${record.chain_id}`,
      amountUsd,
      status: "confirmed",
      communitySlug: record.community_slug ?? undefined,
      receiptHref: canonicalOutcomeHref(record.public_reference),
      explorerUrl: explorerTxUrl(record.tx_hash),
      at: record.issued_at.toISOString(),
    };
  });

  return {
    ok: true,
    live: rows.length > 0,
    rows,
    updatedAt,
  };
}
