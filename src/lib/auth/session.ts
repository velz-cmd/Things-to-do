import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { RESOLVE_AGENT_ESCROW_ADDRESS } from "@/lib/arc/config";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as DbUser } from "@prisma/client";

export { getSessionUserId } from "@/lib/wallet/service";

type AuthError = { error: string; status: 401 | 403 | 404 };

export async function getSessionUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireSessionUser(): Promise<
  AuthError | { user: SupabaseUser }
> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Sign in with Google or email to continue", status: 401 };
  }
  return { user };
}

export async function requireReadyUser(): Promise<
  AuthError | { user: SupabaseUser; profile: DbUser }
> {
  const session = await requireSessionUser();
  if ("error" in session) return session;

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!profile?.walletAddress) {
    return {
      error: "Connect your crypto wallet to continue",
      status: 403,
    };
  }

  return { user: session.user, profile };
}

export async function assertTaskOwner(
  taskId: string,
  userId: string
): Promise<AuthError | { task: Awaited<ReturnType<typeof prisma.task.findUnique>> & object }> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Task not found", status: 404 };
  if (task.userId && task.userId !== userId) {
    return { error: "Not your task", status: 403 };
  }
  return { task };
}

export function agentEscrowLabel() {
  const a = RESOLVE_AGENT_ESCROW_ADDRESS;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
