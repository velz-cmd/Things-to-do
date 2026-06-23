import { sendEmail } from "@/lib/resend/client";

export { getResendClient, sendEmail } from "@/lib/resend/client";

export async function sendClaimEmail(params: {
  to: string;
  subject: string;
  body: string;
  taskId?: string;
}) {
  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <p style="color: #3dd68c; font-weight: 600;">RESOLVE — Compensation Claim</p>
      <p>${params.body.replace(/\n/g, "<br/>")}</p>
      ${params.taskId ? `<p style="color: #8b9aab; font-size: 12px;">Task ref: ${params.taskId}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #1e2d3a; margin: 16px 0;" />
      <p style="color: #8b9aab; font-size: 12px;">Sent autonomously by RESOLVE.</p>
    </div>
  `;

  const to = process.env.RESEND_CLAIM_TO ?? params.to;

  return sendEmail({
    to,
    subject: params.subject,
    html,
  });
}
