import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/browser/app-url";
import { buildPasswordResetEmailHtml } from "@/lib/auth/sign-in-email";
import { parseOtpCooldown } from "@/lib/auth/otp-cooldown";
import {
  checkEmailLinkRateLimit,
  recordEmailLinkRequest,
} from "@/lib/auth/email-rate-limit";
import { deliverAuthEmail } from "@/lib/email/deliver";

export const runtime = "nodejs";

const RESET_REDIRECT = () =>
  `${getAppBaseUrl()}/auth/callback?next=/auth/reset-password`;

function mapResetError(message: string) {
  const cooldown = parseOtpCooldown(message);
  if (cooldown) {
    return {
      error: `Please wait ${cooldown}s before requesting another reset link.`,
      cooldownSeconds: cooldown,
    };
  }
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return {
      error:
        "Too many reset requests. Wait a few minutes, or use wallet sign-in.",
      cooldownSeconds: 120,
    };
  }
  return { error: message };
}

/**
 * Password reset — one Supabase generateLink call, email via Resend/Brevo only.
 * Never calls resetPasswordForEmail (avoids Supabase mail limits + wrong templates).
 */
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

  const limit = await checkEmailLinkRateLimit(email).catch(() => null);
  if (limit && !limit.allowed) {
    return NextResponse.json(
      {
        error: limit.message,
        cooldownSeconds: limit.cooldownSeconds,
      },
      { status: 429 }
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
    const mapped = mapResetError(error.message);
    return NextResponse.json(mapped, {
      status: mapped.cooldownSeconds ? 429 : 400,
    });
  }

  const resetLink = data.properties?.action_link;
  if (!resetLink) {
    return NextResponse.json(
      { error: "Could not create a password reset link." },
      { status: 500 }
    );
  }

  if (data.user?.id) {
    await supabase.auth.admin
      .updateUserById(data.user.id, { email_confirm: true })
      .catch(() => {
        /* non-fatal */
      });
  }

  const delivered = await deliverAuthEmail({
    to: email,
    subject: "Set your password for RESOLVE",
    html: buildPasswordResetEmailHtml({ resetLink, expiresMinutes: 60 }),
  });

  if (!delivered.ok) {
    return NextResponse.json({ error: delivered.message }, { status: 502 });
  }

  await recordEmailLinkRequest(email).catch(() => {
    /* non-fatal */
  });

  return NextResponse.json({
    ok: true,
    delivery: delivered.provider,
    message: "Password reset link sent. Open it and choose a new password.",
  });
}
