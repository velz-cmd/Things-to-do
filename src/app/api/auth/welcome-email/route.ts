import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend/client";

export async function POST(req: Request) {
  const { email, name, isNewUser } = await req.json();
  if (!email || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://resolve-self.vercel.app";

  const subject = isNewUser
    ? "Welcome to RESOLVE"
    : "Signed in to RESOLVE";

  const body = isNewUser
    ? `Hi${name ? ` ${name}` : ""},

Your RESOLVE account is ready. Assign a real-world outcome, upload proof, and unlock proof-based payment only when verified.

Open RESOLVE: ${appUrl}

— RESOLVE`
    : `Hi${name ? ` ${name}` : ""},

You signed in to RESOLVE successfully.

Open your dashboard: ${appUrl}

— RESOLVE`;

  try {
    await sendEmail({
      to: email,
      subject,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Email failed" },
      { status: 500 }
    );
  }
}
