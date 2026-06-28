import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";
import { LEGACY_REDIRECTS } from "@/components/resolve/layout/nav";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const legacyTarget = LEGACY_REDIRECTS[pathname];
  if (legacyTarget && legacyTarget !== pathname) {
    return NextResponse.redirect(new URL(legacyTarget, request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = getSupabaseServerUrl();
  const key =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
