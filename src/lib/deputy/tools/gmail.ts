import type { ToolResult } from "./index";
import { getGmailAccessToken } from "@/lib/google/gmail-token";

export async function gmailSearchReceipts(
  query: string,
  userId?: string | null
): Promise<ToolResult<{ bookingRef: string; merchant: string; amountUsd: number }>> {
  const token = await getGmailAccessToken(userId);
  if (token) {
    try {
      const q = encodeURIComponent(`subject:(receipt OR booking OR confirmation) ${query}`);
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=3`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as { messages?: { id: string }[] };
        const id = data.messages?.[0]?.id;
        if (id) {
          const msg = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const meta = (await msg.json()) as {
            snippet?: string;
            payload?: { headers?: { name: string; value: string }[] };
          };
          const refMatch = meta.snippet?.match(/[A-Z]{2,}-\d{3,}/);
          const fromHeader = meta.payload?.headers?.find((h) => h.name === "From")?.value ?? "";
          const merchant =
            fromHeader.replace(/<.*>/, "").trim() ||
            (query.includes("stream") ? "StreamDemo" : "SkyDemo Airlines");
          return {
            ok: true,
            tool: "gmail.searchReceipts",
            costUsd: 0.004,
            data: {
              bookingRef: refMatch?.[0] ?? `BK-${query.slice(0, 4).toUpperCase()}`,
              merchant,
              amountUsd: 43,
            },
          };
        }
      }
    } catch (e) {
      console.warn("Gmail API failed:", e);
      return {
        ok: false,
        tool: "gmail.searchReceipts",
        costUsd: 0,
        error: e instanceof Error ? e.message : "Gmail search failed",
      };
    }
  }

  if (process.env.DEPUTY_DEMO_MODE === "true") {
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

  return {
    ok: false,
    tool: "gmail.searchReceipts",
    costUsd: 0,
    error: "Gmail not connected — authorize at /api/connectors/gmail/authorize",
  };
}

export async function gmailFindProof(
  merchantId: string,
  type: "refund" | "cancellation",
  userId?: string | null
): Promise<ToolResult<{ found: boolean; confirmationId?: string; snippet?: string }>> {
  const token = await getGmailAccessToken(userId);
  if (token) {
    try {
      const q = encodeURIComponent(
        `from:(${merchantId}) (refund OR cancellation OR confirmed) newer_than:30d`
      );
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as { messages?: { id: string }[] };
        if (data.messages?.[0]) {
          return {
            ok: true,
            tool: "gmail.findProof",
            costUsd: 0.003,
            data: {
              found: true,
              confirmationId: `GMAIL-${data.messages[0].id.slice(0, 8)}`,
            },
          };
        }
      }
      return {
        ok: true,
        tool: "gmail.findProof",
        costUsd: 0.003,
        data: { found: false },
      };
    } catch (e) {
      console.warn("Gmail findProof failed:", e);
    }
  }

  if (process.env.DEPUTY_DEMO_MODE === "true") {
    return {
      ok: true,
      tool: "gmail.findProof",
      costUsd: 0.003,
      data: { found: type === "cancellation" },
    };
  }

  return {
    ok: true,
    tool: "gmail.findProof",
    costUsd: 0.003,
    data: { found: false },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
