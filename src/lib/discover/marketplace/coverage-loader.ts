import "server-only";

import { prisma } from "@/lib/db";
import type { CoverageRecord } from "@/lib/discover/impact/economic-matching";

/**
 * Phase 5 Release Slice 8: real confirmed/pending coverage for a batch of
 * canonical work source ids, loaded in one bounded operation (never one
 * query per row).
 *
 * Traced the real payment path before writing this (recordConfirmedDirectSupport
 * in direct-support.ts, resolvePayableVerifiedWork in verified-work-payment.ts):
 * Receipt.payload.work.subjectId is already the exact same canonical
 * MarketplaceOpportunity.source.id value used everywhere else in the
 * matching pipeline - the join key genuinely exists, it was just never
 * queried in the Discover read path.
 *
 * Confirmed coverage mirrors buildLiveSettlements()'s exact "authoritative
 * confirmed settlement" contract (live-settlements.ts) - a receipt only
 * counts once its linked ChainTransaction is genuinely confirmed on-chain,
 * with a real tx hash, confirmation timestamp, and amount. direct_support
 * payments (payload.type === "direct_support") never count as coverage for
 * a work-reward obligation - different purpose, voluntary, unscoped.
 *
 * Pending coverage comes from a real, different source: ActionRun rows in
 * state "pending_external" for aggregateType "VerifiedWork" - the exact
 * persisted record the wallet/send route itself creates while a transfer
 * is in flight, before any Receipt exists.
 *
 * Legacy receipts have no obligationId/period/policy fingerprint - this
 * loader does not invent them. Coverage records without an obligationId
 * fall through to assessOverlap()'s existing same-purpose comparison
 * (economic-matching.ts), which already reports "possible_overlap"
 * rather than a false-confident duplicate match - the correct, already-
 * built behavior for ambiguous legacy coverage, not new logic.
 */

type ConfirmedWorkRewardRow = {
  work_subject_id: string | null;
  work_title: string | null;
  amount_micro_usdc: bigint;
  public_reference: string;
  tx_hash: string | null;
};

type PendingWorkRewardRun = {
  id: string;
  aggregateId: string | null;
  input: unknown;
};

export async function loadCoverageBySourceId(
  sourceIds: string[],
): Promise<Map<string, CoverageRecord[]>> {
  const map = new Map<string, CoverageRecord[]>();
  const ids = [...new Set(sourceIds.filter((id) => id.trim().length > 0))];
  if (!ids.length || !process.env.DATABASE_URL) return map;

  const [confirmed, pending] = await Promise.all([
    prisma.$queryRaw<ConfirmedWorkRewardRow[]>`
      SELECT
        r.payload->'work'->>'subjectId' AS work_subject_id,
        r.payload->'work'->>'title' AS work_title,
        r."totalUsdcMicro" AS amount_micro_usdc,
        r."publicReference" AS public_reference,
        t."txHash" AS tx_hash
      FROM "Receipt" r
      INNER JOIN "ChainTransaction" t ON t.id = r."chainTransactionId"
      WHERE t.status = 'confirmed'
        AND t."txHash" IS NOT NULL
        AND t."confirmedAt" IS NOT NULL
        AND t."amountUsdcMicro" IS NOT NULL
        AND r.payload->>'type' = 'work_reward'
        AND r.payload->'work'->>'subjectId' = ANY(${ids})
    `,
    prisma.actionRun.findMany({
      where: {
        aggregateType: "VerifiedWork",
        aggregateId: { in: ids },
        state: "pending_external",
      },
      select: { id: true, aggregateId: true, input: true },
    }),
  ]).catch(
    () => [[], []] as [ConfirmedWorkRewardRow[], PendingWorkRewardRun[]],
  );

  for (const row of confirmed) {
    if (!row.work_subject_id) continue;
    const records = map.get(row.work_subject_id) ?? [];
    records.push({
      id: row.public_reference,
      mechanism: "direct_support",
      amountUsd: Number(row.amount_micro_usdc) / 1_000_000,
      purpose: row.work_title ?? "verified outcome support",
      receiptReference: row.tx_hash ?? row.public_reference,
      status: "confirmed",
    });
    map.set(row.work_subject_id, records);
  }

  for (const run of pending) {
    if (!run.aggregateId) continue;
    const input =
      run.input && typeof run.input === "object" && !Array.isArray(run.input)
        ? (run.input as Record<string, unknown>)
        : null;
    const amountUsd = typeof input?.amountUsd === "number" ? input.amountUsd : null;
    if (amountUsd == null) continue;
    const records = map.get(run.aggregateId) ?? [];
    // ActionRun.input does not persist the work's title (only
    // workSubjectId/repository/sourceUrl - see wallet/send/route.ts) -
    // fall back honestly rather than inventing one.
    records.push({
      id: run.id,
      mechanism: "direct_support",
      amountUsd,
      purpose: "verified outcome support",
      status: "pending",
    });
    map.set(run.aggregateId, records);
  }

  return map;
}
