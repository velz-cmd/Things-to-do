import { sendEmail } from "@/lib/resend/client";

export { getResendClient, sendEmail } from "@/lib/resend/client";

export async function sendClaimEmail(params: {
  to: string;
  subject: string;
  body: string;
  claimUrl?: string;
  taskId?: string;
}) {
  const cta =
    params.claimUrl
      ? `<p style="margin: 20px 0;">
      <a href="${params.claimUrl}" style="display: inline-block; background: #3dd68c; color: #0a0f18; font-weight: 600; text-decoration: none; padding: 12px 20px; border-radius: 8px;">
        Claim your earnings
      </a>
    </p>
    <p style="color: #8b9aab; font-size: 12px; word-break: break-all;">${params.claimUrl}</p>`
      : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 560px;">
      <p style="color: #3dd68c; font-weight: 600;">RESOLVE — You earned</p>
      <p>${params.body.replace(/\n/g, "<br/>")}</p>
      ${cta}
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
