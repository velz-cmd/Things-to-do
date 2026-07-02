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
  isLikelyMagicLinkPending,
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

type DeliveryFailure = {
  ok: false;
  status: number;
  error: string;
  cooldownSeconds?: number;
  pendingVerify?: boolean;
};

type DeliverySuccess = {
  ok: true;
  delivery: "resend" | "supabase";
};

type DeliveryResult = DeliverySuccess | DeliveryFailure;

function withPendingFlag(
  error: string,
  cooldownSeconds?: number
): Pick<DeliveryFailure, "error" | "cooldownSeconds" | "pendingVerify"> {
  return {
    error,
    cooldownSeconds,
    pendingVerify: isLikelyMagicLinkPending(error, cooldownSeconds),
  };
}

/** Supabase sends the magic-link email to any global inbox. */
async function deliverViaSupabaseMagicLink(
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
    const mapped = mapAuthEmailError(error.message);
    return {
      ok: false,
      status: cooldownSeconds ? 429 : 400,
      ...withPendingFlag(mapped, cooldownSeconds),
    };
  }

  return { ok: true, delivery: "supabase" };
}

/** Resend delivers a branded magic-link email (optional — needs verified domain). */
async function deliverViaResendMagicLink(
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
    const mapped = mapAuthEmailError(error.message);
    return {
      ok: false,
      status: cooldownSeconds ? 429 : 400,
      ...withPendingFlag(mapped, cooldownSeconds),
    };
  }

  const magicLink = data.properties?.action_link;
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
        expiresMinutes: LINK_VALID_MINUTES,
      }),
    });
    return { ok: true, delivery: "resend" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Resend delivery failed";
    console.error("[auth/send-code] Resend failed:", message);

    if (isResendSandboxError(message)) {
      return deliverViaSupabaseMagicLink(email, redirectTo);
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
    return deliverViaResendMagicLink(email, redirectTo);
  }
  return deliverViaSupabaseMagicLink(email, redirectTo);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();

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

  const limit = await checkEmailLinkRateLimit(email).catch(() => null);
  if (limit && !limit.allowed) {
    return NextResponse.json(
      {
        error: limit.message,
        cooldownSeconds: limit.cooldownSeconds,
        pendingVerify: true,
      },
      { status: 429 }
    );
  }

  const redirectTo = `${getAppBaseUrl()}/auth/callback`;
  const delivered = await deliverMagicLink(email, redirectTo);

  if (!delivered.ok) {
    return NextResponse.json(
      {
        error: delivered.error,
        cooldownSeconds: delivered.cooldownSeconds,
        pendingVerify: delivered.pendingVerify ?? false,
      },
      { status: delivered.status }
    );
  }

  await recordEmailLinkRequest(email);

  return NextResponse.json({
    ok: true,
    serverSend: true,
    delivery: delivered.delivery,
    message: "Sign-in link sent to your inbox",
    expiresInMinutes: LINK_VALID_MINUTES,
    resendCooldownSeconds: Math.ceil(MIN_RESEND_INTERVAL_MS / 1000),
  });
}
