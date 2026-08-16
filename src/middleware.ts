import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";
import { LEGACY_REDIRECTS } from "@/components/resolve/layout/nav";

export async function middleware(request: NextRequest) {
  // Middleware runs before every page. Anything that throws here returns a
  // platform 500 before the app renders, and the failure is invisible to the
  // app's own error reporting because it happens in the edge runtime. It must
  // therefore be fail-open: refreshing a session is an optimisation, and a
  // request that cannot be refreshed is simply a signed-out request.
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("[middleware] failing open", error);
    return NextResponse.next({ request });
  }
}

async function handleRequest(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Password reset links use token_hash (not PKCE code) — see buildPasswordRecoveryUrl.
  if (pathname === "/") {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    if (code || tokenHash) {
      const callback = request.nextUrl.clone();
      callback.pathname = "/auth/callback";
      return NextResponse.redirect(callback);
    }
  }

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

  // Refreshing a stale session performs a network call to Supabase. If that
  // call fails or times out, middleware must still return the response:
  // throwing here turns every page request into a 500 before the app renders,
  // which is exactly what a returning user hits on their first page load.
  // A failed refresh is not fatal - the app handles a signed-out request.
  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error("[middleware] session refresh failed", error);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
