import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { buildUserEligibleWork } from "@/lib/earn/user-eligible-work";

export const dynamic = "force-dynamic";

/** Fast profile work stream for client prefetch — same data as ProfileWorkServer. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, streams: [] });
  }

  try {
    const profile = await ensureProfileForUser(user);
    const streams = await buildUserEligibleWork({ userId: user.id, profile });
    return NextResponse.json({ ok: true, signedIn: true, streams });
  } catch {
    return NextResponse.json({ ok: true, signedIn: true, streams: [], degraded: true });
  }
}
