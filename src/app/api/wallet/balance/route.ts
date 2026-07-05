import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId, ensureUserProfile } from "@/lib/wallet/service";
import { ensureAppWalletForUser } from "@/lib/wallet/app-wallet-service";
import { getRealSpendableUsd, syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import { resolveBalanceWalletAddress, resolveUserWallet } from "@/lib/wallet/resolve-user-wallet";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({
      availableUsd: 0,
      lockedUsd: 0,
      releasedUsd: 0,
      recentActivity: [],
      authenticated: false,
    });
  }

  const sync = new URL(req.url).searchParams.get("sync") === "1";

  let profile = await ensureUserProfile({ id: userId });
  profile = await ensureAppWalletForUser(profile);

  if (sync) {
    await syncIdentityBalance(userId).catch(() => null);
  }

  const balance = await getRealSpendableUsd(userId, { sync: false });
  const walletAddress = resolveBalanceWalletAddress(userId, profile);

  const tasks = await prisma.task.findMany({ where: { userId } });
  const lockedUsd = tasks
    .filter(
      (t) =>
        t.escrowLocked && !["settled", "refunded", "failed"].includes(t.status),
    )
    .reduce((s, t) => s + t.budgetUsd, 0);
  const releasedUsd = tasks
    .filter((t) => t.status === "settled")
    .reduce((s, t) => s + t.recoveredUsd, 0);

  const recentActivity = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    availableUsd: balance.availableUsd,
    onChainUsd: balance.onChainUsd,
    reservedUsd: balance.reservedUsd,
    walletAddress,
    lockedUsd,
    releasedUsd,
    recentActivity: recentActivity.map((t) => ({
      id: t.id,
      type: t.type,
      label: t.label,
      amountUsd: t.amountUsd,
      createdAt: t.createdAt.toISOString(),
    })),
    authenticated: true,
  });
}
