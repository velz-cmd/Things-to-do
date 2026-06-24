import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { googleOAuthConfigured } from "@/lib/google/oauth";

/** Legacy POST — prefer GET /api/connectors/gmail/authorize for OAuth consent. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  if (!googleOAuthConfigured()) {
    return NextResponse.json({
      ok: false,
      state: "needs_auth",
      message:
        "Gmail OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    state: "needs_auth",
    authorizeUrl: `${origin}/api/connectors/gmail/authorize`,
    message: "Redirect to Gmail authorization",
  });
}
