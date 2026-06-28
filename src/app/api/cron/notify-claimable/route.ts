import { NextResponse } from "next/server";
import { notifyAllUnnotifiedClaimable } from "@/lib/earn/notify";

function authorized(req: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.BOOTSTRAP_SENSOR_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Passive channel — email payees when claimable authorizations pass notify policy. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await notifyAllUnnotifiedClaimable();
  const emailed = results.filter((r) => r.emailSent).length;
  const skipped = results.filter((r) => r.skipped).length;

  return NextResponse.json({
    ok: true,
    processed: results.length,
    emailed,
    skipped,
    results: results.map((r) => ({
      payee: `${r.payeeKeyType}:${r.payeeKey}`,
      amountUsd: r.amountUsd,
      emailSent: r.emailSent,
      skipped: r.skipped,
      reason: r.reason,
      urgency: r.urgency,
    })),
  });
}

export async function GET(req: Request) {
  return POST(req);
}
