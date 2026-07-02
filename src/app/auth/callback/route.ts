import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerUrl } from "@/lib/supabase/admin";
import { ensureProfileForUser } from "@/lib/auth/session";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { prisma } from "@/lib/db";

function appOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = (requestUrl.searchParams.get("type") ?? "email") as EmailOtpType;
  const nextParam = requestUrl.searchParams.get("next") ?? "/mission";
  const isPasswordReset =
    type === "recovery" || nextParam.startsWith("/auth/reset-password");
  const next = isPasswordReset ? "/auth/reset-password" : nextParam;
  const authError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      isPasswordReset ?
        `${origin}/auth/reset-password?auth_error=${encodeURIComponent(authError)}`
      : `${origin}/?auth_error=${encodeURIComponent(authError)}`,
    );
  }

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
  let response = NextResponse.redirect(`${origin}${next}`);

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

  try {
    if (tokenHash && isPasswordReset) {
      const params = new URLSearchParams({
        token_hash: tokenHash,
        type: "recovery",
      });
      return NextResponse.redirect(`${origin}/auth/reset-password?${params}`);
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const recoveryHint =
          isPasswordReset ?
            " Request a new password reset email and open the latest link once."
          : "";
        const dest =
          isPasswordReset ?
            `${origin}/auth/reset-password?auth_error=${encodeURIComponent(error.message + recoveryHint)}`
          : `${origin}/?auth_error=${encodeURIComponent(error.message + recoveryHint)}`;
        return NextResponse.redirect(dest);
      }
    } else if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) {
        return NextResponse.redirect(
          `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
        );
      }
      if (data.user && !isPasswordReset) {
        try {
          await ensureProfileForUser(data.user);
        } catch {
          /* provisioned on next API call */
        }
      }
    } else {
      const { data: existing } = await supabase.auth.getUser();
      if (existing.user) {
        return response;
      }
      return NextResponse.redirect(
        `${origin}/auth/callback/complete${requestUrl.search}`
      );
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && !isPasswordReset) {
      try {
        await ensureProfileForUser(userData.user);
        const profile = await prisma.user.findUnique({
          where: { id: userData.user.id },
          select: { githubUsername: true, listenbrainzUsername: true },
        });
        if (profile) {
          await autoInstallCommunitiesForUser(userData.user.id, profile);
        }
      } catch {
        /* non-fatal */
      }
    }

    return response;
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Sign-in link expired or already used. Request a new one.";
    const dest =
      isPasswordReset ?
        `${origin}/auth/reset-password?auth_error=${encodeURIComponent(message)}`
      : `${origin}/?auth_error=${encodeURIComponent(message)}`;
    return NextResponse.redirect(dest);
  }
}
