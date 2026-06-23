import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export async function sendClaimEmail(params: {
  to: string;
  subject: string;
  body: string;
  taskId?: string;
}) {
  const resend = getResend();
  if (!resend) return null;

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const to = process.env.RESEND_CLAIM_TO ?? params.to;

  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <p style="color: #3dd68c; font-weight: 600;">DEPUTY — Compensation Claim</p>
      <p>${params.body.replace(/\n/g, "<br/>")}</p>
      ${params.taskId ? `<p style="color: #8b9aab; font-size: 12px;">Task ref: ${params.taskId}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #1e2d3a; margin: 16px 0;" />
      <p style="color: #8b9aab; font-size: 12px;">Sent autonomously by DEPUTY outcome engine.</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: params.subject,
    html,
  });

  if (error) throw new Error(error.message);
  return data;
}
