import {
  isResendProductionReady,
  isResendSandboxError,
  sendEmail,
} from "@/lib/resend/client";

export type EmailDeliveryResult =
  | { ok: true; provider: "resend" | "brevo" }
  | { ok: false; message: string };

export type AuthEmailDeliveryStatus = {
  resend: boolean;
  resendProductionReady: boolean;
  brevo: boolean;
  brevoFromEmail: boolean;
  brevoSmtpKeyMisconfigured: boolean;
  primary: "resend" | "brevo" | null;
};

export function getAuthEmailDeliveryStatus(): AuthEmailDeliveryStatus {
  const resend = Boolean(process.env.RESEND_API_KEY?.trim());
  const resendProductionReady = isResendProductionReady();
  const brevoKey = process.env.BREVO_API_KEY?.trim() ?? "";
  const brevoSmtpKeyMisconfigured = Boolean(brevoKey) && isBrevoSmtpKey(brevoKey);
  const brevo = Boolean(brevoKey) && !brevoSmtpKeyMisconfigured;
  const brevoFromEmail = Boolean(process.env.BREVO_FROM_EMAIL?.trim());
  const brevoReady = brevo && brevoFromEmail;

  let primary: AuthEmailDeliveryStatus["primary"] = null;
  if (resendProductionReady) primary = "resend";
  else if (brevoReady) primary = "brevo";
  else if (resend) primary = "resend";

  return {
    resend,
    resendProductionReady,
    brevo,
    brevoFromEmail,
    brevoSmtpKeyMisconfigured,
    primary,
  };
}

/** Brevo SMTP keys (xsmtpsib-) cannot authenticate REST API calls. */
export function isBrevoSmtpKey(key: string): boolean {
  return key.trim().startsWith("xsmtpsib-");
}

function brevoKeyMisconfiguration(apiKey: string): EmailDeliveryResult | null {
  if (isBrevoSmtpKey(apiKey)) {
    return {
      ok: false,
      message:
        "BREVO_API_KEY is an SMTP key (xsmtpsib-). Create an API key (xkeysib-) in Brevo → SMTP & API → API keys, then update Vercel and redeploy.",
    };
  }
  return null;
}

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

  const misconfigured = brevoKeyMisconfiguration(apiKey);
  if (misconfigured) return misconfigured;

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

/** Ping Brevo account API — confirms API key without sending mail. */
export async function verifyBrevoConnection(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "BREVO_API_KEY is not set." };
  }
  if (!process.env.BREVO_FROM_EMAIL?.trim()) {
    return { ok: false, message: "BREVO_FROM_EMAIL is not set." };
  }

  const misconfigured = brevoKeyMisconfiguration(apiKey);
  if (misconfigured) return misconfigured;

  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, message: text || `Brevo account check failed (${res.status})` };
  }

  return { ok: true };
}

/** Deliver auth email via Resend or Brevo — never Supabase built-in mailer. */
export async function deliverAuthEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailDeliveryResult> {
  const status = getAuthEmailDeliveryStatus();
  const brevoReady = status.brevo && status.brevoFromEmail;

  if (status.primary === "brevo" && brevoReady) {
    const brevo = await sendViaBrevo(input);
    if (brevo.ok) return brevo;
  }

  if (status.resend) {
    try {
      await sendEmail({
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true, provider: "resend" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Resend failed";
      if (brevoReady) {
        const brevo = await sendViaBrevo(input);
        if (brevo.ok) return brevo;
      }
      if (!isResendSandboxError(message)) {
        return { ok: false, message };
      }
      /* Resend sandbox — fall through to Brevo */
    }
  }

  if (brevoReady) {
    const brevo = await sendViaBrevo(input);
    if (brevo.ok) return brevo;
  }

  return {
    ok: false,
    message:
      "Email delivery is not configured for all users yet. Add BREVO_API_KEY + BREVO_FROM_EMAIL on Vercel (free, no domain), enable Production env, then Redeploy — see docs/SUPABASE_AUTH.md.",
  };
}
