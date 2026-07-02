import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/browser/app-url";
import {
  buildPasswordResetEmailHtml,
  buildPasswordRecoveryUrl,
  buildPasswordResetUrl,
} from "@/lib/auth/sign-in-email";
import { parseOtpCooldown } from "@/lib/auth/otp-cooldown";
import {
  checkEmailLinkRateLimit,
  recordEmailLinkRequest,
} from "@/lib/auth/email-rate-limit";
import { deliverAuthEmail } from "@/lib/email/deliver";
import {
  createPasswordResetToken,
  PasswordResetStorageError,
} from "@/lib/auth/password-reset-token";
import { ensureUserProfile } from "@/lib/wallet/service";
import { sanitizeAuthApiError } from "@/lib/auth/sanitize-auth-error";

export const runtime = "nodejs";

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
  return { error: sanitizeAuthApiError(message, "Could not send reset link.") };
}

function legacyResetLinkFromGenerateLink(data: {
  properties?: { action_link?: string; hashed_token?: string } | null;
}): string | null {
  const hashedToken = data.properties?.hashed_token?.trim();
  if (hashedToken) {
    return buildPasswordRecoveryUrl(hashedToken);
  }
  return data.properties?.action_link?.trim() ?? null;
}

/**
 * Password reset — app-owned Postgres token (prefetch-safe) with Supabase fallback
 * when the PasswordResetToken table is not migrated yet.
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
      { status: 503 },
    );
  }

  const limit = await checkEmailLinkRateLimit(email).catch(() => null);
  if (limit && !limit.allowed) {
    return NextResponse.json(
      {
        error: limit.message,
        cooldownSeconds: limit.cooldownSeconds,
      },
      { status: 429 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Password reset is not configured on the server." },
      { status: 503 },
    );
  }

  const redirectTo = `${getAppBaseUrl()}/auth/callback?next=/auth/reset-password`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("user not found") || lower.includes("not found")) {
      return NextResponse.json({
        ok: true,
        message: "If that email has an account, we sent a reset link.",
      });
    }
    const mapped = mapResetError(error.message);
    return NextResponse.json(mapped, {
      status: mapped.cooldownSeconds ? 429 : 400,
    });
  }

  const userId = data.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Could not create a password reset link." },
      { status: 500 },
    );
  }

  await supabase.auth.admin
    .updateUserById(userId, { email_confirm: true })
    .catch(() => {
      /* non-fatal */
    });

  let resetLink: string;
  try {
    const { plain } = await createPasswordResetToken({ userId, email });
    resetLink = buildPasswordResetUrl(plain);
  } catch (e) {
    if (e instanceof PasswordResetStorageError) {
      const fallback = legacyResetLinkFromGenerateLink(data);
      if (!fallback) {
        return NextResponse.json(
          {
            error:
              "Password reset is temporarily unavailable. Try wallet sign-in or retry in a few minutes.",
          },
          { status: 503 },
        );
      }
      resetLink = fallback;
      console.warn("[auth] PasswordResetToken table missing — sent legacy Supabase link");
    } else {
      return NextResponse.json(
        {
          error: sanitizeAuthApiError(
            e,
            "Could not send reset link. Try again in a moment.",
          ),
        },
        { status: 500 },
      );
    }
  }

  await ensureUserProfile({
    id: userId,
    email,
    authProvider: "email",
  }).catch(() => {
    /* profile row created on password save if this fails */
  });

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
