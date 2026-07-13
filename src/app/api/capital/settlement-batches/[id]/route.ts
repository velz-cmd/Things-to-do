import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { arcFeatureFlags } from "@/lib/arc/feature-flags";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";
import { ARC_CLIENT_WALLET_ADDRESS, hasCircleCredentials } from "@/lib/settlement/arc-config";

type RouteContext = { params: Promise<{ id: string }> };

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function GET(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { id } = await context.params;
  const batch = await prisma.settlementBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Settlement package not found" }, { status: 404 });
  if (batch.userId !== ready.profile.id) {
    return NextResponse.json({ error: "This settlement package belongs to another account" }, { status: 403 });
  }
  const transactions = await prisma.chainTransaction.findMany({
    where: { settlementBatchId: batch.id },
    orderBy: { submittedAt: "asc" },
    select: { id: true, providerTransactionId: true, txHash: true, status: true, failureCode: true, failureMessage: true, amountUsdcMicro: true },
  });
  const prepared = batch.preparedPackage as Record<string, unknown>;
  const url = new URL(req.url);
  const executionEnabled = arcFeatureFlags.batchSettlement && arcFeatureFlags.memo && hasCircleCredentials() && Boolean(ARC_CLIENT_WALLET_ADDRESS);
  return NextResponse.json({
    batch: {
      id: batch.id,
      communitySlug: batch.communitySlug,
      status: batch.status,
      totalUsd: formatUsdcTokenUnits(batch.totalUsdcMicro),
      totalUsdcMicro: batch.totalUsdcMicro.toString(),
      payeeCount: batch.payeeCount,
      programId: typeof prepared.programId === "string" ? prepared.programId : null,
      policyVersionId: typeof prepared.policyVersionId === "string" ? prepared.policyVersionId : null,
      simulationId: batch.simulationId,
      packageHash: typeof prepared.packageHash === "string" ? prepared.packageHash : null,
      evidenceRootHash: typeof prepared.evidenceRootHash === "string" ? prepared.evidenceRootHash : null,
      preparedAt: typeof prepared.preparedAt === "string" ? prepared.preparedAt : batch.createdAt.toISOString(),
      submittedAt: batch.submittedAt?.toISOString() ?? null,
      confirmedAt: batch.confirmedAt?.toISOString() ?? null,
      returnTo: safeReturnTo(url.searchParams.get("returnTo")),
      transactions: transactions.map((transaction) => ({
        ...transaction,
        amountUsdcMicro: transaction.amountUsdcMicro?.toString() ?? null,
      })),
    },
    execution: {
      enabled: executionEnabled,
      blocker: !arcFeatureFlags.batchSettlement
        ? "Arc batch settlement is disabled until testnet capability checks pass."
        : !arcFeatureFlags.memo
          ? "Arc memo settlement is disabled until contract capability checks pass."
          : !hasCircleCredentials()
            ? "Circle credentials are not provisioned for live settlement."
            : !ARC_CLIENT_WALLET_ADDRESS
              ? "The Arc settlement wallet is not provisioned."
          : null,
    },
  });
}
