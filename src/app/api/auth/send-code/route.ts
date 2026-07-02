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
import {
  isResendProductionReady,
  isResendSandboxError,
  sendEmail,
} from "@/lib/resend/client";

export const runtime = "nodejs";
export const maxDuration = 30;

type DeliveryResult =
  | {
      ok: true;
      delivery: "resend" | "supabase";
      otpSent: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      cooldownSeconds?: number;
      pendingVerify?: boolean;
    };

async function deliverViaSupabaseOtp(
  email: string,
  redirectTo: string
): Promise<DeliveryResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: "Email sign-in is not configured on the server.",
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    const cooldownSeconds = parseOtpCooldown(error.message);
    return {
      ok: false,
      status: cooldownSeconds ? 429 : 400,
      error: mapAuthEmailError(error.message),
      cooldownSeconds,
      pendingVerify: Boolean(cooldownSeconds),
    };
  }

  return { ok: true, delivery: "supabase", otpSent: true };
}

async function deliverViaResend(
  email: string,
  redirectTo: string
): Promise<DeliveryResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: "Email sign-in is not configured on the server.",
    };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    const cooldownSeconds = parseOtpCooldown(error.message);
    return {
      ok: false,
      status: cooldownSeconds ? 429 : 400,
      error: mapAuthEmailError(error.message),
      cooldownSeconds,
      pendingVerify: Boolean(cooldownSeconds),
    };
  }

  const magicLink = data.properties?.action_link;
  const otp = data.properties?.email_otp;
  if (!magicLink) {
    return {
      ok: false,
      status: 500,
      error: "Could not create a sign-in link. Try again.",
    };
  }

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
    return { ok: true, delivery: "resend", otpSent: Boolean(otp) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Resend delivery failed";
    console.error("[auth/send-code] Resend failed:", message);

    if (isResendSandboxError(message)) {
      return deliverViaSupabaseOtp(email, redirectTo);
    }

    return {
      ok: false,
      status: 502,
      error: `Could not deliver email: ${message}`,
    };
  }
}

async function deliverMagicLink(
  email: string,
  redirectTo: string
): Promise<DeliveryResult> {
  if (isResendProductionReady()) {
    return deliverViaResend(email, redirectTo);
  }

  // Resend sandbox (onboarding@resend.dev) only delivers to the account owner.
  // Use Supabase Auth email so any inbox can receive the OTP + magic link.
  return deliverViaSupabaseOtp(email, redirectTo);
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
          pendingVerify: limit.reason === "interval",
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
        pendingVerify: delivered.pendingVerify ?? Boolean(delivered.cooldownSeconds),
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
