/**
 * DEPUTY tool layer — agents call controlled backend tools, never raw APIs.
 */

import { sendClaimEmail } from "./resend";

export interface ToolResult<T = unknown> {
  ok: boolean;
  tool: string;
  data?: T;
  error?: string;
  costUsd: number;
}

export async function gmailSearchReceipts(query: string): Promise<
  ToolResult<{ bookingRef: string; merchant: string; amountUsd: number }>
> {
  await delay(120);
  return {
    ok: true,
    tool: "gmail.searchReceipts",
    costUsd: 0.004,
    data: {
      bookingRef: `BK-${query.slice(0, 4).toUpperCase() || "SD482"}`,
      merchant: query.includes("stream") ? "StreamDemo" : "SkyDemo Airlines",
      amountUsd: 43,
    },
  };
}

export async function gmailFindProof(
  merchantId: string,
  type: "refund" | "cancellation"
): Promise<ToolResult<{ found: boolean; confirmationId?: string }>> {
  await delay(80);
  return {
    ok: true,
    tool: "gmail.findProof",
    costUsd: 0.003,
    data: { found: false },
  };
}

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

export async function browserSubmitClaim(portalUrl: string): Promise<
  ToolResult<{ submitted: boolean; ticketId: string }>
> {
  await delay(200);
  return {
    ok: true,
    tool: "browser.submitClaim",
    costUsd: 0.015,
    data: {
      submitted: true,
      ticketId: `TKT-${portalUrl.slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    },
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
    data: {
      charges: [{ amount: 12.99, cadence: "monthly" }],
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
