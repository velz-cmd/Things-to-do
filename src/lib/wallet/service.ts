import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function ensureUserProfile(params: {
  id: string;
  email?: string | null;
  displayName?: string | null;
  authProvider?: string;
}) {
  return prisma.user.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      email: params.email ?? undefined,
      displayName: params.displayName ?? undefined,
      authProvider: params.authProvider ?? "google",
      embeddedWallet: true,
      availableUsd: 0,
    },
    update: {
      email: params.email ?? undefined,
      displayName: params.displayName ?? undefined,
    },
  });
}

export async function getWalletBalance(userId: string) {
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
    availableUsd: user.availableUsd,
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
