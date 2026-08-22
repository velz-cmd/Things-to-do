import { prisma } from "@/lib/db";
import { ensureRequestPayoutSchema } from "@/lib/db/ensure-request-payout-schema";
import { transferUsdcPayout } from "@/lib/settlement/circle-client";
import { verifyArcTx } from "@/lib/settlement/arc-verify";

export type ContributorPayoutResult =
  | { status: "confirmed"; txHash: string; payoutId: string }
  | { status: "failed"; error: string; payoutId: string };

/**
 * Second settlement leg for a Request release.
 *
 * ERC-8183's `complete()` always pays the job's fixed `provider` address -
 * there is no on-chain call to reassign it, and the contributor is only
 * known once the Request is taken, long after the job (and its provider)
 * were created. This function performs the follow-on transfer from that
 * fixed wallet to the contributor's verified payout address.
 *
 * Idempotent and retry-safe: `opportunityId` is unique, so a second call for
 * the same Request either short-circuits on an already-confirmed row or
 * retries a previously failed one - it never re-sends a confirmed transfer.
 * The unique-constraint race on concurrent first calls is handled by
 * re-reading the row a competing request already created.
 */
export async function releaseContributorPayout(input: {
  opportunityId: string;
  settlementBatchId: string;
  fromAddress: string;
  toAddress: string;
  amountUsdcMicro: bigint;
}): Promise<ContributorPayoutResult> {
  await ensureRequestPayoutSchema();

  const idempotencyKey = `request-payout:${input.opportunityId}`;

  let row = await prisma.requestContributorPayout.findUnique({
    where: { opportunityId: input.opportunityId },
  });

  if (row?.status === "confirmed" && row.txHash) {
    return { status: "confirmed", txHash: row.txHash, payoutId: row.id };
  }

  if (!row) {
    try {
      row = await prisma.requestContributorPayout.create({
        data: {
          opportunityId: input.opportunityId,
          settlementBatchId: input.settlementBatchId,
          fromAddress: input.fromAddress,
          toAddress: input.toAddress,
          amountUsdcMicro: input.amountUsdcMicro,
          status: "pending",
          idempotencyKey,
        },
      });
    } catch {
      // A concurrent call already inserted the row for this Request.
      row = await prisma.requestContributorPayout.findUnique({
        where: { opportunityId: input.opportunityId },
      });
      if (!row) throw new Error("Contributor payout row missing after create race");
      if (row.status === "confirmed" && row.txHash) {
        return { status: "confirmed", txHash: row.txHash, payoutId: row.id };
      }
    }
  }

  try {
    const txHash = await transferUsdcPayout({
      fromWalletAddress: row.fromAddress,
      toAddress: row.toAddress,
      amountTokenUnits: row.amountUsdcMicro.toString(),
      idempotencyKey: row.idempotencyKey,
    });
    await verifyArcTx(txHash);
    await prisma.requestContributorPayout.update({
      where: { id: row.id },
      data: { status: "confirmed", txHash, error: null },
    });
    return { status: "confirmed", txHash, payoutId: row.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Contributor payout failed";
    await prisma.requestContributorPayout.update({
      where: { id: row.id },
      data: { status: "failed", error: message },
    });
    return { status: "failed", error: message, payoutId: row.id };
  }
}

export async function getContributorPayout(opportunityId: string) {
  await ensureRequestPayoutSchema();
  return prisma.requestContributorPayout.findUnique({ where: { opportunityId } });
}
