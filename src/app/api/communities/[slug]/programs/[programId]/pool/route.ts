import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getCommunityPoolState } from "@/lib/capital/community-pool-state";
import { prisma } from "@/lib/db";
import { API_CACHE } from "@/lib/api/cache-headers";

type Params = { params: Promise<{ slug: string; programId: string }> };

export const dynamic = "force-dynamic";

/** Program pool snapshot — communal totals for the program's community. */
export async function GET(_req: Request, { params }: Params) {
  const { programId } = await params;

  const sessionUser = await getSessionUser();
  const viewerId = sessionUser
    ? (await ensureProfileForUser(sessionUser).catch(() => null))?.id ?? null
    : null;

  const program = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: { install: { select: { communitySlug: true } } },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const communitySlug = program.install?.communitySlug;
  if (!communitySlug) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const { pool } = await getCommunityPoolState(communitySlug, program.templateId, viewerId);
  if (!pool) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, pool },
    { headers: { "Cache-Control": API_CACHE.noStore } },
  );
}
