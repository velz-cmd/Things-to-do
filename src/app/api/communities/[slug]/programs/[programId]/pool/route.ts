import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { API_CACHE } from "@/lib/api/cache-headers";

type Params = { params: Promise<{ slug: string; programId: string }> };

export const dynamic = "force-dynamic";

/** Program pool snapshot — public read; your stake when signed in. */
export async function GET(_req: Request, { params }: Params) {
  const { programId } = await params;

  const sessionUser = await getSessionUser();
  const viewerId = sessionUser
    ? (await ensureProfileForUser(sessionUser).catch(() => null))?.id ?? null
    : null;

  const pool = await getProgramPoolState(programId, viewerId);
  if (!pool) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, pool },
    { headers: { "Cache-Control": API_CACHE.publicShort } },
  );
}
