import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend/client";

const SEND_COOLDOWN_MS = 60_000;
const recentSends = new Map<string, number>();

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://resolve-task.vercel.app"
  );
}

function loginCodeEmailHtml(code: string) {
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
                <h1 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Your login code</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#94a3b8;">
                  Enter this code in RESOLVE to sign in. It expires in 30 minutes and can only be used once.
                </p>
                <div style="text-align:center;padding:20px;background:#05080c;border-radius:12px;border:1px solid rgba(56,189,248,0.2);">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#38bdf8;font-family:ui-monospace,monospace;">${code}</span>
                </div>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
                  If you didn't request this, you can ignore this email.
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
    return NextResponse.json(
      {
        error:
          "Login codes are not configured. Add SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 503 }
    );
  }

  const last = recentSends.get(email) ?? 0;
  if (Date.now() - last < SEND_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a minute before requesting another code." },
      { status: 429 }
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${appOrigin()}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const otp = data.properties?.email_otp;
  if (!otp) {
    return NextResponse.json(
      { error: "Could not generate login code. Try again." },
      { status: 500 }
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email delivery is not configured. Add RESEND_API_KEY." },
      { status: 503 }
    );
  }

  try {
    await sendEmail({
      to: email,
      subject: `${otp} is your RESOLVE login code`,
      html: loginCodeEmailHtml(otp),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send email" },
      { status: 500 }
    );
  }

  recentSends.set(email, Date.now());

  return NextResponse.json({
    ok: true,
    message: "Login code sent",
    expiresInMinutes: 30,
  });
}
