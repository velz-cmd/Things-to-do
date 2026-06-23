import { createClient } from "@supabase/supabase-js";

/** Server-side Supabase URL — never rely on NEXT_PUBLIC_* alone (build-time inlined). */
export function getSupabaseServerUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

/** Service role key for admin auth operations. */
export function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    ""
  );
}

/** Service-role client — server only. Never import in client components. */
export function createAdminClient() {
  const url = getSupabaseServerUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getSupabaseServerUrl() && getSupabaseServiceRoleKey());
}
