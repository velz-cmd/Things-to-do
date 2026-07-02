import { NextResponse } from "next/server";
import {
  deliverAuthEmail,
  getAuthEmailDeliveryStatus,
  verifyBrevoConnection,
} from "@/lib/email/deliver";
import { authorizeCronRequest } from "@/lib/env/cron-secret";

/** Safe email delivery diagnostics — never returns secret values. */
export async function GET() {
  const status = getAuthEmailDeliveryStatus();
  const brevoCheck = status.brevo && status.brevoFromEmail ? await verifyBrevoConnection() : null;

  return NextResponse.json({
    ok: Boolean(status.primary),
    status,
    brevo: brevoCheck,
    note:
      status.brevoSmtpKeyMisconfigured ?
        "BREVO_API_KEY is an SMTP key (xsmtpsib-). Create an API key (xkeysib-) in Brevo → SMTP & API → API keys."
      : status.primary === "brevo" ?
        "Auth emails use Brevo (Resend is sandbox-only or unset)."
      : status.primary === "resend" ?
        "Auth emails use Resend."
      : "No email provider ready — add BREVO_API_KEY + BREVO_FROM_EMAIL on Vercel Production, then Redeploy.",
  });
}

/** Operator test — send a delivery probe via the active provider. */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json(
      { error: "Operator auth required — use Authorization: Bearer CRON_SECRET" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const to = String((body as { to?: string }).to ?? "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Provide { to: \"email@example.com\" }" }, { status: 400 });
  }

  const delivered = await deliverAuthEmail({
    to,
    subject: "RESOLVE email delivery test",
    html: "<p>If you received this, auth email delivery is working.</p>",
  });

  if (!delivered.ok) {
    return NextResponse.json({ ok: false, error: delivered.message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    provider: delivered.provider,
    message: `Test email sent to ${to} via ${delivered.provider}.`,
  });
}
