import type { ToolResult } from "./index";

export async function gmailSearchReceipts(query: string): Promise<
  ToolResult<{ bookingRef: string; merchant: string; amountUsd: number }>
> {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      const token = await refreshGoogleToken();
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
          const subject =
            meta.payload?.headers?.find((h) => h.name === "Subject")?.value ??
            "Booking receipt";
          const refMatch = meta.snippet?.match(/[A-Z]{2,}-\d{3,}/);
          return {
            ok: true,
            tool: "gmail.searchReceipts",
            costUsd: 0.004,
            data: {
              bookingRef: refMatch?.[0] ?? `BK-${query.slice(0, 4).toUpperCase()}`,
              merchant: query.includes("stream") ? "StreamDemo" : "SkyDemo Airlines",
              amountUsd: 43,
            },
          };
        }
      }
    } catch (e) {
      console.warn("Gmail API failed, using mock:", e);
    }
  }

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
): Promise<ToolResult<{ found: boolean; confirmationId?: string; snippet?: string }>> {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      const token = await refreshGoogleToken();
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
    } catch (e) {
      console.warn("Gmail findProof failed:", e);
    }
  }

  return {
    ok: true,
    tool: "gmail.findProof",
    costUsd: 0.003,
    data: { found: false },
  };
}

async function refreshGoogleToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Gmail token refresh failed");
  return data.access_token;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
