import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { buildCommunitySurface } from "@/lib/communities/surface";
import { getCommunityBySlug } from "@/lib/communities/catalog";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const ready = await requireReadyUser();
  const userId = "error" in ready ? null : ready.user.id;
  const surface = await buildCommunitySurface(userId, slug);
  if (!surface) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, community: surface });
}
