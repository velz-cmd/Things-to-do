import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Provider } from "@supabase/supabase-js";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/browser/app-url";

const OAUTH_PROVIDERS = new Set<Provider>(["google", "github"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as Provider;
  const origin = getAppBaseUrl();

  if (!OAUTH_PROVIDERS.has(provider)) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent("Unsupported sign-in provider")}`
    );
  }

  const requestUrl = new URL(request.url);
  const defaultNext = provider === "github" ? "/profile" : "/missions";
  const next = requestUrl.searchParams.get("next") ?? defaultNext;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const url = getSupabaseServerUrl();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent("Auth not configured")}`
    );
  }

  const cookieStore = await cookies();
  let response = NextResponse.next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === "google" ? "openid email profile" : "read:user",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(
        error?.message ?? "Could not start sign-in"
      )}`
    );
  }

  const redirectResponse = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}
