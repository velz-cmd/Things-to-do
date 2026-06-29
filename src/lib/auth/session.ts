import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { RESOLVE_AGENT_ESCROW_ADDRESS } from "@/lib/arc/config";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as DbUser } from "@prisma/client";
import { ensureUserProfile } from "@/lib/wallet/service";
import { ensureAppWalletForUser } from "@/lib/wallet/app-wallet-service";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";

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

export async function ensureProfileForUser(
  user: SupabaseUser
): Promise<DbUser> {
  const provider =
    user.app_metadata?.provider === "email"
      ? "email"
      : user.app_metadata?.provider === "github"
        ? "github"
      : user.app_metadata?.provider ?? "google";

  let profile = await ensureUserProfile({
    id: user.id,
    email: user.email,
    displayName:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0],
    authProvider: provider,
  });

  profile = await ensureAppWalletForUser(profile);

  void autoInstallCommunitiesForUser(user.id, profile).catch(() => undefined);

  return profile;
}

/** Signed-in user with auto-provisioned embedded wallet (email-only OK). */
export async function requireReadyUser(): Promise<
  AuthError | { user: SupabaseUser; profile: DbUser }
> {
  const session = await requireSessionUser();
  if ("error" in session) return session;

  const profile = await ensureProfileForUser(session.user);
  return { user: session.user, profile };
}

export async function assertTaskOwner(
  taskId: string,
  userId: string
): Promise<
  AuthError | { task: Awaited<ReturnType<typeof prisma.task.findUnique>> & object }
> {
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
