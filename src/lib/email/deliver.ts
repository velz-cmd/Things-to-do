import { sendEmail, isResendSandboxError } from "@/lib/resend/client";

export type EmailDeliveryResult =
  | { ok: true; provider: "resend" | "brevo" }
  | { ok: false; message: string };

/** Optional Brevo (Sendinblue) — free tier, verify a Gmail sender, no domain required. */
async function sendViaBrevo(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailDeliveryResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    return { ok: false, message: "Brevo is not configured." };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME?.trim() || "RESOLVE",
        email: fromEmail,
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, message: text || `Brevo send failed (${res.status})` };
  }

  return { ok: true, provider: "brevo" };
}

/** Deliver auth email via Resend, then Brevo — never Supabase built-in mailer. */
export async function deliverAuthEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailDeliveryResult> {
  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendEmail({
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true, provider: "resend" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Resend failed";
      if (!isResendSandboxError(message)) {
        const brevo = await sendViaBrevo(input);
        if (brevo.ok) return brevo;
        return { ok: false, message };
      }
      /* Resend sandbox — try Brevo next */
    }
  }

  const brevo = await sendViaBrevo(input);
  if (brevo.ok) return brevo;

  return {
    ok: false,
    message:
      "Email delivery is not configured for all users yet. Add BREVO_API_KEY + BREVO_FROM_EMAIL on Vercel (free, no domain) — see docs/SUPABASE_AUTH.md.",
  };
}
