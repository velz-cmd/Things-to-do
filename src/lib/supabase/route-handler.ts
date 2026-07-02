import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";

/** Supabase client that writes auth cookies onto a Route Handler response. */
export async function createRouteHandlerClient(
  response: NextResponse,
) {
  const url = getSupabaseServerUrl();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            /* read-only cookie store */
          }
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
