import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend/client";

/**
 * POST /api/email/test
 * Sends a test email via Resend using server env vars.
 * Body: { to?: string, subject?: string }
 */
export async function POST(req: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not set in environment" },
      { status: 500 }
    );
  }

  let body: { to?: string; subject?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const to =
    body.to ?? process.env.RESEND_CLAIM_TO ?? "podrift.mail@gmail.com";
  const subject = body.subject ?? "RESOLVE — Hello from Resend";

  try {
    const data = await sendEmail({
      to,
      subject,
      html: "<p>Congrats on sending your <strong>first email</strong> from RESOLVE!</p>",
    });

    return NextResponse.json({
      ok: true,
      messageId: data?.id,
      to,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.RESEND_API_KEY),
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    defaultTo: process.env.RESEND_CLAIM_TO ?? null,
    hint: "POST to this route to send a test email",
  });
}
