import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Signed-in user's RESOLVE id — use as RESOLVE_USER_ID for jellyfin-bridge.env */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(
      { ok: false, signedIn: false, error: "Sign in at /profile first" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    signedIn: true,
    userId: authUser.id,
    email: authUser.email ?? null,
    bridgeEnvHint:
      "Copy userId into jellyfin-bridge.env as RESOLVE_USER_ID, then run scripts/jellyfin-bridge.bat",
  });
}
