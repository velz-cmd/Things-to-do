import { NextResponse } from "next/server";
import { notifyAllUnnotifiedClaimable } from "@/lib/earn/notify";
import { authorizeCronRequest } from "@/lib/env/cron-secret";

/** Passive channel — email payees when claimable authorizations pass notify policy. */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
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
