import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { ensureUserProfile } from "@/lib/wallet/service";

function authProviderFromUser(user: SupabaseUser) {
  const provider = user.app_metadata?.provider;
  if (provider === "email") return "email";
  if (provider === "github") return "github";
  return provider ?? "google";
}

/**
 * Read connector fields from Postgres without Circle wallet provisioning or other write side effects.
 * Use for Profile identity display and cross-tab connection state — must stay fast.
 */
export async function loadProfileFast(authUser: SupabaseUser): Promise<User> {
  await ensureUserProfile({
    id: authUser.id,
    email: authUser.email,
    displayName:
      (authUser.user_metadata?.full_name as string | undefined) ??
      (authUser.user_metadata?.name as string | undefined) ??
      authUser.email?.split("@")[0],
    authProvider: authProviderFromUser(authUser),
  });

  const row = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!row) {
    throw new Error("profile_missing");
  }

  return sanitizeConnectorIdentities(authUser.id, row);
}
