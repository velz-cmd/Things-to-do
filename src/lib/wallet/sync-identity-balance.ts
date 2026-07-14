import { prisma } from "@/lib/db";
import { getCachedArcUsdcBalance } from "@/lib/cache/arc-balance-cache";
import {
  resolveOnChainReadAddress,
  resolveUserWallet,
} from "@/lib/wallet/resolve-user-wallet";

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
export async function syncIdentityBalance(
  userId: string,
  options?: { observedAmountMicroUsdc?: string },
): Promise<IdentityBalanceSyncResult> {
  const profile = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile) {
    return {
      synced: false,
      adjustedUsd: 0,
      onChainUsd: null,
      reservedUsd: 0,
      availableUsd: 0,
    };
  }

  const walletAddress = resolveOnChainReadAddress(userId, profile);
  const reservedUsd = await getReservedForPrograms(userId);

  let onChainUsd: number;
  try {
    if (options?.observedAmountMicroUsdc) {
      onChainUsd = round(Number(BigInt(options.observedAmountMicroUsdc)) / 1_000_000);
    } else {
      const bal = await getCachedArcUsdcBalance(walletAddress);
      onChainUsd = round(Number(bal.amountMicroUsdc) / 1_000_000);
    }
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

  if (Math.abs(delta) < MIN_SYNC_USD) {
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
      data:
        delta > 0
          ? { availableUsd: { increment: delta } }
          : { availableUsd: { decrement: Math.abs(delta) } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId,
        type: delta > 0 ? "deposit" : "withdrawal",
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

/** Read-only spendable balance — no ledger writes (safe for UI snapshots). */
export async function readIdentityBalance(userId: string): Promise<{
  availableUsd: number;
  onChainUsd: number | null;
  reservedUsd: number;
}> {
  const profile = await prisma.user.findUnique({ where: { id: userId } });
  if (!profile) {
    return { availableUsd: 0, onChainUsd: null, reservedUsd: 0 };
  }

  const reservedUsd = await getReservedForPrograms(userId).catch(() => 0);
  return {
    availableUsd: resolveSpendableUsd({
      availableUsd: profile.availableUsd,
      onChainUsd: null,
      reservedUsd,
    }),
    onChainUsd: null,
    reservedUsd,
  };
}

/** Spendable balance — syncs ledger when requested (e.g. before send/bridge). */
export async function getRealSpendableUsd(
  userId: string,
  opts?: { sync?: boolean },
): Promise<{
  availableUsd: number;
  onChainUsd: number | null;
  reservedUsd: number;
}> {
  if (opts?.sync) {
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
  }

  return readIdentityBalance(userId);
}
