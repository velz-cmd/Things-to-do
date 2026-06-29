import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { getPendingAuthorizationsForUser } from "@/lib/events/live";

/** Pending program authorizations — real ledger rows tied to user's programs. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const rows = await getPendingAuthorizationsForUser(session.user.id, 32);
  const totalUsd = Math.round(rows.reduce((s, r) => s + r.amountUsd, 0) * 10000) / 10000;

  return NextResponse.json({
    ok: true,
    totalUsd,
    count: rows.length,
    authorizations: rows,
    updatedAt: new Date().toISOString(),
  });
}
