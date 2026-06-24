import { NextResponse } from "next/server";
import { ensureCircleWalletSet } from "@/lib/wallet/circle-config";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** One-time bootstrap: create Circle wallet set and persist ID for per-user app wallets. */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ensureCircleWalletSet();
    return NextResponse.json({
      ok: true,
      ...result,
      hint: "Add CIRCLE_WALLET_SET_ID to Vercel env for faster cold starts (optional; also stored in DB).",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Circle wallet set setup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
