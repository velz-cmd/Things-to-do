import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { API_CACHE } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { loadProfileControlPlaneBootstrap } from "@/lib/profile/control-plane-bootstrap";

export const dynamic = "force-dynamic";

/** Persisted-only Profile control-plane bootstrap. Provider health refreshes happen separately. */
export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) return NextResponse.json({ ok: true, signedIn: false }, { headers: { "Cache-Control": API_CACHE.noStore } });

  const rate = await rateLimitRequest(`profile:bootstrap:${getRequestClientId(req, authUser.id)}`, 30, 60);
  if (!rate.success) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": API_CACHE.noStore } });

  try {
    const payload = await cacheGetOrSet(`profile:control-plane:${authUser.id}`, 15, () => loadProfileControlPlaneBootstrap(authUser));
    return NextResponse.json(payload, { headers: { "Cache-Control": API_CACHE.privateShort } });
  } catch (error) {
    reportApiError("profile/bootstrap", error, { userId: authUser.id });
    return NextResponse.json({ ok: false, signedIn: true, error: "PROFILE_BOOTSTRAP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": API_CACHE.noStore } });
  }
}
