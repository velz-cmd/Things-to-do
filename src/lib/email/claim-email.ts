import { deliverAuthEmail } from "@/lib/email/deliver";

export async function sendCreatorClaimEmail(params: {
  to: string;
  subject: string;
  body: string;
  claimUrl?: string;
  taskId?: string;
}): Promise<{ ok: boolean; provider?: string; error?: string }> {
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
      <p style="color: #3dd68c; font-weight: 600;">RESOLVE — You've earned</p>
      <p style="color: #e8eef4; line-height: 1.5;">${params.body.replace(/\n/g, "<br/>")}</p>
      ${cta}
      ${params.taskId ? `<p style="color: #8b9aab; font-size: 12px;">Program ref: ${params.taskId}</p>` : ""}
      <hr style="border: none; border-top: 1px solid #1e2d3a; margin: 16px 0;" />
      <p style="color: #8b9aab; font-size: 12px;">Value was recognized by a connector you already use. Claim once — no account required beforehand.</p>
    </div>
  `;

  const to = process.env.RESEND_CLAIM_TO?.trim() || params.to;
  const result = await deliverAuthEmail({ to, subject: params.subject, html });
  if (!result.ok) {
    return { ok: false, error: result.message };
  }
  return { ok: true, provider: result.provider };
}
