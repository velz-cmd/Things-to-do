import { NextResponse } from "next/server";
import {
  createAdminClient,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { parseOtpCooldown } from "@/lib/auth/otp-cooldown";
import {
  buildSignInEmailHtml,
  mapAuthEmailError,
} from "@/lib/auth/sign-in-email";
import {
  checkEmailLinkRateLimit,
  LINK_VALID_MINUTES,
  MIN_RESEND_INTERVAL_MS,
  recordEmailLinkRequest,
} from "@/lib/auth/email-rate-limit";
import { getAppBaseUrl } from "@/lib/browser/app-url";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const maxDuration = 30;

async function deliverMagicLink(email: string, redirectTo: string) {
  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Email sign-in is not configured on the server." };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    const cooldownSeconds = parseOtpCooldown(error.message);
    return {
      ok: false as const,
      status: cooldownSeconds ? 429 : 400,
      error: mapAuthEmailError(error.message),
      cooldownSeconds,
    };
  }

  const magicLink = data.properties?.action_link;
  const otp = data.properties?.email_otp;
  if (!magicLink) {
    return {
      ok: false as const,
      status: 500,
      error: "Could not create a sign-in link. Try again.",
    };
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendEmail({
        to: email,
        subject: "Sign in to RESOLVE",
        html: buildSignInEmailHtml({
          magicLink,
          otp: otp ?? undefined,
          expiresMinutes: LINK_VALID_MINUTES,
        }),
      });
      return { ok: true as const, delivery: "resend" as const, otpSent: Boolean(otp) };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Resend delivery failed";
      console.error("[auth/send-code] Resend failed:", message);
      // Fall through to Supabase mailer if Resend fails (e.g. unverified domain).
    }
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });

  if (otpError) {
    const cooldownSeconds = parseOtpCooldown(otpError.message);
    return {
      ok: false as const,
      status: cooldownSeconds ? 429 : 400,
      error: mapAuthEmailError(otpError.message),
      cooldownSeconds,
    };
  }

  return { ok: true as const, delivery: "supabase" as const, otpSent: false };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();
  const confirm = Boolean((body as { confirm?: boolean }).confirm);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    const hasUrl = Boolean(getSupabaseServerUrl());
    const hasKey = Boolean(getSupabaseServiceRoleKey());
    return NextResponse.json(
      {
        error: hasKey
          ? "Supabase URL missing on server. Add SUPABASE_URL in Vercel env."
          : hasUrl
            ? "Email sign-in needs SUPABASE_SERVICE_ROLE_KEY on the server."
            : "Email sign-in is not configured on the server.",
      },
      { status: 503 }
    );
  }

  try {
    const limit = await checkEmailLinkRateLimit(email);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: limit.message,
          cooldownSeconds: limit.cooldownSeconds,
          reason: limit.reason,
        },
        { status: 429 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify sign-in limits. Try again shortly." },
      { status: 503 }
    );
  }

  if (confirm) {
    await recordEmailLinkRequest(email);
    return NextResponse.json({ ok: true, recorded: true });
  }

  const redirectTo = `${getAppBaseUrl()}/auth/callback`;
  const delivered = await deliverMagicLink(email, redirectTo);

  if (!delivered.ok) {
    return NextResponse.json(
      {
        error: delivered.error,
        cooldownSeconds: delivered.cooldownSeconds,
      },
      { status: delivered.status }
    );
  }

  await recordEmailLinkRequest(email);

  return NextResponse.json({
    ok: true,
    serverSend: true,
    delivery: delivered.delivery,
    otpSent: delivered.otpSent,
    message: "Sign-in link sent to your inbox",
    expiresInMinutes: LINK_VALID_MINUTES,
    resendCooldownSeconds: Math.ceil(MIN_RESEND_INTERVAL_MS / 1000),
  });
}
