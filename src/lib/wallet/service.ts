import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";

export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

type EnsureUserProfileInput = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  authProvider?: string;
};

/** Create or lightly update user — find-first avoids upsert contention under pool pressure. */
export async function ensureUserProfile(params: EnsureUserProfileInput) {
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (existing) {
    const email = params.email ?? undefined;
    const displayName = params.displayName ?? undefined;
    const authProvider = params.authProvider ?? undefined;
    const changed =
      (email !== undefined && email !== existing.email) ||
      (displayName !== undefined && displayName !== existing.displayName) ||
      (authProvider !== undefined && authProvider !== existing.authProvider);

    if (!changed) return existing;

    return prisma.user.update({
      where: { id: params.id },
      data: { email, displayName, authProvider },
    });
  }

  return prisma.user.create({
    data: {
      id: params.id,
      email: params.email ?? undefined,
      displayName: params.displayName ?? undefined,
      authProvider: params.authProvider ?? "email",
      embeddedWallet: true,
      availableUsd: 0,
    },
  });
}

export async function getWalletBalance(userId: string) {
  const real = await getRealSpendableUsd(userId).catch(() => null);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      availableUsd: 0,
      lockedUsd: 0,
      releasedUsd: 0,
      recentActivity: [],
    };
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
  });

  const lockedUsd = tasks
    .filter(
      (t) =>
        t.escrowLocked && !["settled", "refunded", "failed"].includes(t.status)
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

  return {
    availableUsd: real?.availableUsd ?? user.availableUsd,
    onChainUsd: real?.onChainUsd ?? null,
    reservedUsd: real?.reservedUsd ?? 0,
    lockedUsd,
    releasedUsd,
    recentActivity: recentActivity.map((t) => ({
      id: t.id,
      type: t.type,
      label: t.label,
      amountUsd: t.amountUsd,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
