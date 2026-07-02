import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/browser/app-url";
import { buildPasswordResetEmailHtml } from "@/lib/auth/sign-in-email";
import {
  isResendProductionReady,
  isResendSandboxError,
  sendEmail,
} from "@/lib/resend/client";

export const runtime = "nodejs";

const RESET_REDIRECT = () =>
  `${getAppBaseUrl()}/auth/callback?next=/auth/reset-password`;

/** Send branded password-reset email (not Supabase activation template). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 503 }
    );
  }

  const redirectTo = RESET_REDIRECT();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const resetLink = data.properties?.action_link;
  if (!resetLink) {
    return NextResponse.json(
      { error: "Could not create a password reset link." },
      { status: 500 }
    );
  }

  // Unconfirmed magic-link users otherwise get a signup "activation" email from Supabase.
  if (data.user?.id) {
    await supabase.auth.admin
      .updateUserById(data.user.id, { email_confirm: true })
      .catch(() => {
        /* non-fatal */
      });
  }

  const html = buildPasswordResetEmailHtml({ resetLink, expiresMinutes: 60 });

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendEmail({
        to: email,
        subject: "Set your password for RESOLVE",
        html,
      });
      return NextResponse.json({
        ok: true,
        delivery: "resend",
        message: "Password reset link sent. Open it and choose a new password.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Email delivery failed";
      console.error("[auth/forgot-password] Resend failed:", message);

      if (!isResendSandboxError(message) && !isResendProductionReady()) {
        return NextResponse.json(
          { error: `Could not send email: ${message}` },
          { status: 502 }
        );
      }
      /* Resend sandbox — fall through to Supabase mailer */
    }
  }

  const { error: mailError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (mailError) {
    return NextResponse.json({ error: mailError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    delivery: "supabase",
    message:
      "Password reset link sent. If the email says “confirm signup”, open Supabase → Authentication → Email Templates → Reset password and use a “Set your password” subject.",
  });
}
