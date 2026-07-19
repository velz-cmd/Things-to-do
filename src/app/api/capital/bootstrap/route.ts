import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadCapitalBootstrap } from "@/lib/capital/bootstrap";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { API_CACHE } from "@/lib/api/cache-headers";
import { offlineCapitalBootstrap } from "@/lib/capital/bootstrap-fallback";
import { withTimeout } from "@/lib/discover/fetch-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({ ok: false, error: "Sign in to open Capital." }, { status: 401 });
  }

  try {
    const payload = await withTimeout(
      cacheGetOrSet(`capital:bootstrap:${authUser.id}`, 15, () => loadCapitalBootstrap(authUser)),
      7_000,
      offlineCapitalBootstrap(authUser),
    );
    return NextResponse.json(payload, { headers: { "Cache-Control": API_CACHE.noStore } });
  } catch {
    return NextResponse.json(offlineCapitalBootstrap(authUser), {
      headers: { "Cache-Control": API_CACHE.noStore },
    });
  }
}
