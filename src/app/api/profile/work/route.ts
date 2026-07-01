import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { buildUserEligibleWork } from "@/lib/earn/user-eligible-work";

export const dynamic = "force-dynamic";

/** Connected profile work mapped to earn eligibility — never 500. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: true, signedIn: false, workStreams: [] });
  }

  try {
    const profile = await ensureProfileForUser(authUser);
    const workStreams = await buildUserEligibleWork({
      userId: authUser.id,
      profile,
    });
    return NextResponse.json({
      ok: true,
      signedIn: true,
      workStreams,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[profile/work]", e);
    return NextResponse.json({ ok: true, signedIn: true, workStreams: [], degraded: true });
  }
}
