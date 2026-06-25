/**
 * DEPUTY tool layer — agents call controlled backend tools, never raw APIs.
 */

export interface ToolResult<T = unknown> {
  ok: boolean;
  tool: string;
  data?: T;
  error?: string;
  costUsd: number;
}

export { gmailSearchReceipts, gmailFindProof } from "./gmail";
export { paidPremiumResearch, paidFetchResource } from "./paid-resource";
export { browserSubmitClaim } from "./browser";

import { sendClaimEmail } from "./resend";

export async function resendSendClaim(params: {
  to: string;
  subject: string;
  body: string;
  taskId?: string;
}): Promise<ToolResult<{ messageId: string }>> {
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await sendClaimEmail(params);
      return {
        ok: true,
        tool: "resend.sendClaim",
        costUsd: 0.01,
        data: { messageId: result?.id ?? `resend-${Date.now()}` },
      };
    } catch (e) {
      return {
        ok: false,
        tool: "resend.sendClaim",
        costUsd: 0,
        error: e instanceof Error ? e.message : "Resend failed",
      };
    }
  }
  await delay(150);
  return {
    ok: true,
    tool: "resend.sendClaim",
    costUsd: 0.01,
    data: { messageId: `mock-${params.to.slice(0, 4)}-${Date.now()}` },
  };
}

export async function plaidFindRecurring(
  merchantHint: string
): Promise<ToolResult<{ charges: Array<{ amount: number; cadence: string }> }>> {
  await delay(100);
  return {
    ok: true,
    tool: "plaid.findRecurring",
    costUsd: 0.006,
    data: { charges: [{ amount: 12.99, cadence: "monthly" }] },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
