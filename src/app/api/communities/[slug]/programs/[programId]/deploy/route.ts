import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { deployProgramOnArc } from "@/lib/communities/deploy";
import { buildCommunitySurface } from "@/lib/communities/surface";

type Params = { params: Promise<{ slug: string; programId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug, programId } = await params;
  const result = await deployProgramOnArc(ready.user.id, programId);
  const community = await buildCommunitySurface(ready.user.id, slug);

  if (!result.ok) {
    return NextResponse.json({ ...result, community }, { status: 400 });
  }

  return NextResponse.json({ ...result, community });
}
