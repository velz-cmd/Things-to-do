import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { resolvePrimaryProgramForCommunity } from "@/lib/communities/programs";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** Pool snapshot for a community card — resolves the user's primary program when programId is unknown. */
export async function GET(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId") ?? undefined;
  const program = await resolvePrimaryProgramForCommunity(
    ready.user.id,
    slug,
    templateId ?? undefined,
  );

  if (!program) {
    return NextResponse.json({ ok: true, programId: null, pool: null });
  }

  const pool = await getProgramPoolState(program.id, ready.user.id);
  return NextResponse.json({
    ok: true,
    programId: program.id,
    pool,
  });
}
