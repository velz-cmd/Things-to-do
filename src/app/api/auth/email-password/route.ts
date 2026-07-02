import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  isInvalidLogin,
  mapPasswordAuthError,
} from "@/lib/auth/email-password";
import { ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeAuthApiError } from "@/lib/auth/sanitize-auth-error";

export const runtime = "nodejs";

function isExistingUserError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("email address has already been")
  );
}

/**
 * Server-side email + password — sign in or auto-create account.
 * Uses Supabase admin to confirm email instantly (no inbox step).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String((body as { email?: string }).email ?? "")
      .trim()
      .toLowerCase();
    const password = String((body as { password?: string }).password ?? "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: "Email sign-in is not configured on the server." },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Email sign-in is not configured on the server." },
        { status: 503 },
      );
    }

    const response = NextResponse.json({ ok: true });
    const supabase = await createRouteHandlerClient(response);
    if (!supabase) {
      return NextResponse.json(
        { error: "Auth is not configured." },
        { status: 503 },
      );
    }

    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error && signIn.data.user) {
      try {
        await ensureProfileForUser(signIn.data.user);
      } catch {
        /* provisioned on next request */
      }
      return response;
    }

    if (signIn.error && !isInvalidLogin(signIn.error.message)) {
      return NextResponse.json(
        { error: mapPasswordAuthError(signIn.error.message) },
        { status: 400 },
      );
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      if (isExistingUserError(createError.message)) {
        return NextResponse.json(
          {
            error:
              "This email already has an account. Check your password, or use Forgot password to set one.",
            suggestForgotPassword: true,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: sanitizeAuthApiError(
            createError,
            "Could not create account. Try again.",
          ),
        },
        { status: 400 },
      );
    }

    const user = created.user;
    if (!user) {
      return NextResponse.json(
        { error: "Could not create account. Try again." },
        { status: 500 },
      );
    }

    const signInNew = await supabase.auth.signInWithPassword({ email, password });
    if (signInNew.error || !signInNew.data.user) {
      return NextResponse.json(
        {
          error:
            "Account created but sign-in failed. Try signing in again.",
        },
        { status: 400 },
      );
    }

    try {
      await ensureProfileForUser(signInNew.data.user);
    } catch {
      /* provisioned on next request */
    }

    const signedIn = NextResponse.json({ ok: true, isNewUser: true });
    for (const cookie of response.cookies.getAll()) {
      signedIn.cookies.set(cookie.name, cookie.value, cookie);
    }
    return signedIn;
  } catch (e) {
    console.error("[auth] email-password failed:", e);
    return NextResponse.json(
      {
        error: sanitizeAuthApiError(
          e,
          "Could not sign in. Try again in a moment.",
        ),
      },
      { status: 500 },
    );
  }
}
