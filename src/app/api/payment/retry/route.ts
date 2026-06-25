import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getSettlementById, updatePaymentIntents } from "@/lib/payment/store";
import { executeContributorBatch } from "@/lib/payment/execute";

const bodySchema = z.object({
  settlementId: z.string(),
});

/** Retry failed contributor wallets only */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "settlementId required" }, { status: 400 });
  }

  const settlement = await getSettlementById(parsed.data.settlementId);
  if (!settlement) {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }

  const failed = settlement.intents.filter((i) => i.status === "failed");
  if (!failed.length) {
    return NextResponse.json({ message: "No failed payments to retry" });
  }

  const pkg = JSON.parse(settlement.packageJson ?? "{}") as {
    missionId: string;
    repo?: string;
    proofHash: string;
    treasuryAmount: number;
    confidence: number;
  };

  const batch = await executeContributorBatch({
    settlementId: settlement.id,
    missionId: pkg.missionId,
    repo: pkg.repo,
    proofHash: pkg.proofHash,
    batchNumber: settlement.batchNumber ?? 1,
    confidence: pkg.confidence,
    treasuryAmount: pkg.treasuryAmount,
    intents: failed.map((f) => ({
      id: f.id,
      wallet: f.wallet,
      login: f.login ?? undefined,
      weight: f.weight,
      amountUsd: f.amountUsd,
      rank: f.rank,
      status: "pending" as const,
    })),
  });

  await updatePaymentIntents(settlement.id, batch.intents);

  return NextResponse.json({
    retried: failed.length,
    stillFailed: batch.failedWallets,
    explorerUrls: batch.explorerUrls,
  });
}
