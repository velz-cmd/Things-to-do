import { NextResponse } from "next/server";
import {
  createAdminClient,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";

const SEND_COOLDOWN_MS = 60_000;
const recentSends = new Map<string, number>();

function appOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host && !host.includes("localhost")) {
    return `${proto}://${host}`;
  }
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://resolve-task.vercel.app"
  );
}

function parseCooldown(message: string): number | undefined {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : undefined;
}

function canSendViaResend(email: string): boolean {
  if (!process.env.RESEND_API_KEY?.trim()) return false;
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ?? "onboarding@resend.dev";
  if (!from.includes("resend.dev")) return true;
  const allowed = process.env.RESEND_CLAIM_TO?.trim().toLowerCase();
  return Boolean(allowed && email.toLowerCase() === allowed);
}

function loginEmailHtml(code: string, magicLink: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#05080c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#05080c;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:420px;background:#0c1219;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#38bdf8;font-weight:600;">RESOLVE</p>
                <h1 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Sign in to RESOLVE</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#94a3b8;">
                  Enter the code below in RESOLVE, or tap the button to sign in on this device.
                </p>
                <div style="text-align:center;padding:20px;background:#05080c;border-radius:12px;border:1px solid rgba(56,189,248,0.2);margin-bottom:24px;">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#38bdf8;font-family:ui-monospace,monospace;">${code}</span>
                </div>
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="${magicLink}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 28px;border-radius:12px;">Sign in with magic link</a>
                </div>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                  This code and link expire in 30 minutes. If you didn't request this, ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    const hasUrl = Boolean(getSupabaseServerUrl());
    const hasKey = Boolean(getSupabaseServiceRoleKey());
    return NextResponse.json(
      {
        error: hasKey
          ? "Supabase URL missing on server. Add SUPABASE_URL in Vercel env."
          : hasUrl
            ? "Login codes need SUPABASE_SERVICE_ROLE_KEY on the server."
            : "Login codes are not configured on the server.",
      },
      { status: 503 }
    );
  }

  const last = recentSends.get(email) ?? 0;
  if (Date.now() - last < SEND_COOLDOWN_MS) {
    const remaining = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
    return NextResponse.json(
      {
        error: `Please wait ${remaining} seconds before requesting another email.`,
        cooldownSeconds: remaining,
      },
      { status: 429 }
    );
  }

  const redirectTo = `${appOrigin(req)}/auth/callback`;

  if (!canSendViaResend(email)) {
    recentSends.set(email, Date.now());
    return NextResponse.json({
      ok: true,
      delivery: "supabase",
      verifyMode: "link",
      clientSend: true,
      message: "Sign-in link will be sent to your inbox",
      expiresInMinutes: 30,
    });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    const cooldownSeconds = parseCooldown(error.message);
    return NextResponse.json(
      { error: error.message, cooldownSeconds },
      { status: cooldownSeconds ? 429 : 400 }
    );
  }

  const otp = data.properties?.email_otp;
  const magicLink = data.properties?.action_link;
  if (!otp || !magicLink) {
    return NextResponse.json(
      { error: "Could not generate sign-in email. Try again." },
      { status: 500 }
    );
  }

  try {
    await sendEmail({
      to: email,
      subject: `${otp} — sign in to RESOLVE`,
      html: loginEmailHtml(otp, magicLink),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  recentSends.set(email, Date.now());
  return NextResponse.json({
    ok: true,
    delivery: "resend",
    verifyMode: "code",
    message: "Sign-in email sent",
    expiresInMinutes: 30,
  });
}
