import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { resolvePublicProgramForCommunity } from "@/lib/communities/programs";
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
  const program = await resolvePublicProgramForCommunity(slug, templateId ?? undefined);

  if (!program) {
    return NextResponse.json(
      { ok: true, programId: null, pool: null },
      { headers: { "Cache-Control": API_CACHE.publicShort } },
    );
  }

  const pool = await getProgramPoolState(program.id, viewerId);
  return NextResponse.json(
    { ok: true, programId: program.id, pool },
    { headers: { "Cache-Control": API_CACHE.publicShort } },
  );
}
