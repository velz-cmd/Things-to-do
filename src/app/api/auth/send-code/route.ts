import { NextResponse } from "next/server";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  checkEmailLinkRateLimit,
  LINK_VALID_MINUTES,
  MIN_RESEND_INTERVAL_MS,
  recordEmailLinkRequest,
} from "@/lib/auth/email-rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();
  const confirm = Boolean((body as { confirm?: boolean }).confirm);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const admin = isSupabaseAdminConfigured();
  if (!admin) {
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

  return NextResponse.json({
    ok: true,
    clientSend: true,
    delivery: "supabase",
    message: "Sign-in link sent to your inbox",
    expiresInMinutes: LINK_VALID_MINUTES,
    resendCooldownSeconds: Math.ceil(MIN_RESEND_INTERVAL_MS / 1000),
  });
}
