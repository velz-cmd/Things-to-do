import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getCommunityPoolState } from "@/lib/capital/community-pool-state";
import { API_CACHE } from "@/lib/api/cache-headers";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** Pool snapshot for a community card — public read; funder position when signed in. */
export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  const viewerId = sessionUser
    ? (await ensureProfileForUser(sessionUser).catch(() => null))?.id ?? null
    : null;

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId") ?? undefined;
  const { programId, pool } = await getCommunityPoolState(slug, templateId, viewerId);

  if (!programId || !pool) {
    return NextResponse.json(
      { ok: true, programId: programId ?? null, pool: null },
      { headers: { "Cache-Control": API_CACHE.publicShort } },
    );
  }

  return NextResponse.json(
    { ok: true, programId, pool },
    { headers: { "Cache-Control": API_CACHE.noStore } },
  );
}
