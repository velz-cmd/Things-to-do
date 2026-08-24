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
 *
 * Release Slice 13: failure semantics. The confirmed and pending queries
 * used to run through a single `Promise.all([...]).catch(() => [[], []])`
 * - if EITHER query failed, BOTH result sets silently disappeared, even
 * the one that genuinely succeeded. Worse, a real DB failure produced the
 * exact same return value as "queried successfully, no prior payment
 * exists," which a money-mutation caller cannot tell apart from a
 * legitimately clean record - UNKNOWN must never read as EMPTY. Now uses
 * `Promise.allSettled()` so one query's failure never deletes the other's
 * successfully loaded records, and returns real per-source availability
 * so a money-mutation caller (Slice 12's `/api/wallet/send` check) can
 * fail closed instead of silently treating "unavailable" as "zero
 * coverage, safe to fund."
 */

export type SourceAvailability = "available" | "unavailable";

export type CoverageLoadResult = {
  recordsBySourceId: Map<string, CoverageRecord[]>;
  /** Whether the confirmed-settlement (Receipt/ChainTransaction) query actually completed. */
  confirmedAvailability: SourceAvailability;
  /** Whether the pending-transfer (ActionRun) query actually completed. */
  pendingAvailability: SourceAvailability;
};

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
): Promise<CoverageLoadResult> {
  const recordsBySourceId = new Map<string, CoverageRecord[]>();
  const ids = [...new Set(sourceIds.filter((id) => id.trim().length > 0))];
  if (!ids.length || !process.env.DATABASE_URL) {
    return { recordsBySourceId, confirmedAvailability: "available", pendingAvailability: "available" };
  }

  const [confirmedResult, pendingResult] = await Promise.allSettled([
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
  ]);

  const confirmedAvailability: SourceAvailability =
    confirmedResult.status === "fulfilled" ? "available" : "unavailable";
  const pendingAvailability: SourceAvailability =
    pendingResult.status === "fulfilled" ? "available" : "unavailable";

  if (confirmedResult.status === "fulfilled") {
    for (const row of confirmedResult.value) {
      if (!row.work_subject_id) continue;
      const records = recordsBySourceId.get(row.work_subject_id) ?? [];
      records.push({
        id: row.public_reference,
        mechanism: "direct_support",
        amountUsd: Number(row.amount_micro_usdc) / 1_000_000,
        purpose: row.work_title ?? "verified outcome support",
        receiptReference: row.tx_hash ?? row.public_reference,
        status: "confirmed",
      });
      recordsBySourceId.set(row.work_subject_id, records);
    }
  }

  if (pendingResult.status === "fulfilled") {
    for (const run of pendingResult.value) {
      if (!run.aggregateId) continue;
      const input =
        run.input && typeof run.input === "object" && !Array.isArray(run.input)
          ? (run.input as Record<string, unknown>)
          : null;
      const amountUsd = typeof input?.amountUsd === "number" ? input.amountUsd : null;
      if (amountUsd == null) continue;
      const records = recordsBySourceId.get(run.aggregateId) ?? [];
      // Release Slice 13: ActionRun.input now persists the real work title
      // (workTitle, written by the wallet/send route at submission time) -
      // use it when present. Historical rows written before this field
      // existed have no real title to recover, so they fall back to an
      // honestly-labeled "unknown/legacy purpose" rather than a fabricated
      // exact-match string - never claim a specific purpose RESOLVE cannot
      // actually prove.
      const workTitle = typeof input?.workTitle === "string" ? input.workTitle : null;
      records.push({
        id: run.id,
        mechanism: "direct_support",
        amountUsd,
        purpose: workTitle ?? "unknown/legacy purpose (submitted before purpose was persisted)",
        status: "pending",
      });
      recordsBySourceId.set(run.aggregateId, records);
    }
  }

  return { recordsBySourceId, confirmedAvailability, pendingAvailability };
}
