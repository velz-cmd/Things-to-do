import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";
import { ensureProfileForUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = (requestUrl.searchParams.get("type") ?? "email") as EmailOtpType;
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/start";

  if (error) {
    const msg = encodeURIComponent(errorDescription ?? error);
    return NextResponse.redirect(`${requestUrl.origin}/?auth_error=${msg}`);
  }

  const url = getSupabaseServerUrl();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.redirect(
      `${requestUrl.origin}/?auth_error=${encodeURIComponent("Auth not configured")}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* Server Component — ignore */
        }
      },
    },
  });

  if (tokenHash) {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      return NextResponse.redirect(
        `${requestUrl.origin}/?auth_error=${encodeURIComponent(verifyError.message)}`
      );
    }
    if (data.user) {
      try {
        await ensureProfileForUser(data.user);
      } catch {
        /* provisioned on next API call */
      }
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (code) {
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${requestUrl.origin}/?auth_error=${encodeURIComponent(exchangeError.message)}`
      );
    }
    if (data.user) {
      try {
        await ensureProfileForUser(data.user);
      } catch {
        /* provisioned on next API call */
      }
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/?auth_error=${encodeURIComponent("Sign-in link expired or already used. Request a new one.")}`
  );
}
