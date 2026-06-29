import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

export const dynamic = "force-dynamic";

/**
 * Instant RESOLVE wallet address for the signed-in user — no database required.
 * Every email/wallet user gets a unique deterministic Arc address tied to their profile.
 */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const address = embeddedWalletFor(session.user.id).toLowerCase();

  return NextResponse.json({
    ok: true,
    address,
    label: `${address.slice(0, 6)}…${address.slice(-4)}`,
    embedded: true,
    lockedToProfile: true,
  });
}
