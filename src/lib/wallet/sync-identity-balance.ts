import { prisma } from "@/lib/db";
import { getArcUsdcBalance } from "@/lib/wallet/alchemy";

const MIN_SYNC_USD = 0.01;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getReservedForPrograms(userId: string): Promise<number> {
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
  adjustedUsd: number;
  onChainUsd: number | null;
  reservedUsd: number;
  availableUsd: number;
};

/**
 * Keep User.availableUsd aligned with real Arc USDC in the identity wallet.
 * Credits faucet/bridge deposits and removes demo-only ledger inflation.
 */
export async function syncIdentityBalance(userId: string): Promise<IdentityBalanceSyncResult> {
  const profile = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile?.walletAddress) {
    return {
      synced: false,
      adjustedUsd: 0,
      onChainUsd: null,
      reservedUsd: 0,
      availableUsd: profile?.availableUsd ?? 0,
    };
  }

  const reservedUsd = await getReservedForPrograms(userId);

  let onChainUsd: number;
  try {
    const bal = await getArcUsdcBalance(profile.walletAddress);
    onChainUsd = round(bal.balanceUsd);
  } catch {
    return {
      synced: false,
      adjustedUsd: 0,
      onChainUsd: null,
      reservedUsd,
      availableUsd: profile.availableUsd,
    };
  }

  const targetAvailable = round(Math.max(0, onChainUsd - reservedUsd));
  const delta = round(targetAvailable - profile.availableUsd);

  if (delta < MIN_SYNC_USD) {
    return {
      synced: false,
      adjustedUsd: 0,
      onChainUsd,
      reservedUsd,
      availableUsd: resolveSpendableUsd({
        availableUsd: profile.availableUsd,
        onChainUsd,
        reservedUsd,
      }),
    };
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
        amountUsd: Math.abs(delta),
        label: "sync:onchain",
        status: "completed",
      },
    }),
  ]);

  return {
    synced: true,
    adjustedUsd: delta,
    onChainUsd,
    reservedUsd,
    availableUsd: resolveSpendableUsd({
      availableUsd: updated.availableUsd,
      onChainUsd,
      reservedUsd,
    }),
  };
}

/** Hero balance — on-chain USDC minus reserves when Arc read succeeds. */
export function resolveSpendableUsd(input: {
  availableUsd: number;
  onChainUsd: number | null;
  reservedUsd: number;
}): number {
  if (input.onChainUsd !== null) {
    return round(Math.max(0, input.onChainUsd - input.reservedUsd));
  }
  return round(input.availableUsd);
}

/** Spendable balance = on-chain USDC minus program reserves (source of truth). */
export async function getRealSpendableUsd(userId: string): Promise<{
  availableUsd: number;
  onChainUsd: number | null;
  reservedUsd: number;
}> {
  const sync = await syncIdentityBalance(userId);
  if (sync.onChainUsd !== null) {
    return {
      availableUsd: resolveSpendableUsd({
        availableUsd: sync.availableUsd,
        onChainUsd: sync.onChainUsd,
        reservedUsd: sync.reservedUsd,
      }),
      onChainUsd: sync.onChainUsd,
      reservedUsd: sync.reservedUsd,
    };
  }

  const profile = await prisma.user.findUnique({ where: { id: userId } });
  const reservedUsd = await getReservedForPrograms(userId);
  return {
    availableUsd: profile?.availableUsd ?? 0,
    onChainUsd: null,
    reservedUsd,
  };
}
