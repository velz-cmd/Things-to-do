import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { API_CACHE } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { loadProfileControlPlaneBootstrap } from "@/lib/profile/control-plane-bootstrap";
import { offlineProfileBootstrap } from "@/lib/profile/bootstrap-fallback";
import { withTimeout } from "@/lib/discover/fetch-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/** Persisted-only Profile control-plane bootstrap. Provider health refreshes happen separately. */
export async function GET(req: Request) {
  const authUser = await getSessionUser();
  if (!authUser) return NextResponse.json({ ok: true, signedIn: false }, { headers: { "Cache-Control": API_CACHE.noStore } });

  const rate = await rateLimitRequest(`profile:bootstrap:${getRequestClientId(req, authUser.id)}`, 30, 60);
  if (!rate.success) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": API_CACHE.noStore } });

  try {
    const payload = await withTimeout(
      cacheGetOrSet(`profile:control-plane:${authUser.id}`, 15, () => loadProfileControlPlaneBootstrap(authUser)),
      7_000,
      offlineProfileBootstrap(authUser, ["profile_database_timeout"]),
    );
    return NextResponse.json(payload, { headers: { "Cache-Control": API_CACHE.privateShort } });
  } catch (error) {
    reportApiError("profile/bootstrap", error, { userId: authUser.id });
    return NextResponse.json(offlineProfileBootstrap(authUser), {
      headers: { "Cache-Control": API_CACHE.noStore },
    });
  }
}
