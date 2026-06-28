import { prisma } from "@/lib/db";
import { getArcUsdcBalance } from "@/lib/wallet/alchemy";

const MIN_SYNC_USD = 0.01;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

async function getReservedForPrograms(userId: string): Promise<number> {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId, status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: { missionId: true },
  });
  const missionIds = programs.map((p) => p.missionId!).filter(Boolean);
  if (!missionIds.length) return 0;

  const agg = await prisma.paymentAuthorization.aggregate({
    where: { missionId: { in: missionIds }, status: "claimable" },
    _sum: { amountUsd: true },
  });
  return round(agg._sum.amountUsd ?? 0);
}

export type IdentityBalanceSyncResult = {
  synced: boolean;
  creditedUsd: number;
  onChainUsd: number | null;
  availableUsd: number;
};

/**
 * Credit user deposits that arrived on-chain (faucet, bridge, direct transfer)
 * but were not yet recorded in the ledger. Treasury/settlement wallets are never touched.
 */
export async function syncIdentityBalance(userId: string): Promise<IdentityBalanceSyncResult> {
  const profile = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile?.walletAddress) {
    return { synced: false, creditedUsd: 0, onChainUsd: null, availableUsd: profile?.availableUsd ?? 0 };
  }

  let onChainUsd: number;
  try {
    const bal = await getArcUsdcBalance(profile.walletAddress);
    onChainUsd = round(bal.balanceUsd);
  } catch {
    return { synced: false, creditedUsd: 0, onChainUsd: null, availableUsd: profile.availableUsd };
  }

  const reservedUsd = await getReservedForPrograms(userId);
  const accountedUsd = round(profile.availableUsd + reservedUsd);
  const delta = round(onChainUsd - accountedUsd);

  if (delta < MIN_SYNC_USD) {
    return { synced: false, creditedUsd: 0, onChainUsd, availableUsd: profile.availableUsd };
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { availableUsd: { increment: delta } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId,
        type: "deposit",
        method: "crypto",
        amountUsd: delta,
        label: "sync:onchain",
        status: "completed",
      },
    }),
  ]);

  return {
    synced: true,
    creditedUsd: delta,
    onChainUsd,
    availableUsd: updated.availableUsd,
  };
}
