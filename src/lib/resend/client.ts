import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Resend client — API key from RESEND_API_KEY env var (Vercel / .env).
 * Never hardcode your key in source code.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(input: SendEmailInput) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from =
    input.from ?? process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const to = Array.isArray(input.to) ? input.to : [input.to];

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: input.subject,
    html: input.html,
  });

  if (error) throw new Error(error.message);
  return data;
}
