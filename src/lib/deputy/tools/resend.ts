export { getResendClient, sendEmail } from "@/lib/resend/client";

export async function sendClaimEmail(params: {
  to: string;
  subject: string;
  body: string;
  claimUrl?: string;
  taskId?: string;
}) {
  const { sendCreatorClaimEmail } = await import("@/lib/email/claim-email");
  const result = await sendCreatorClaimEmail(params);
  if (!result.ok) {
    throw new Error(result.error ?? "Claim email failed");
  }
  return { id: `${result.provider ?? "email"}-${Date.now()}` };
}
