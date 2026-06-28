import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { installCommunity } from "@/lib/communities/installs";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { buildCommunitySurface } from "@/lib/communities/surface";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug } = await params;
  if (!getCommunityBySlug(slug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const result = await installCommunity(ready.user.id, slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const community = await buildCommunitySurface(ready.user.id, slug);

  return NextResponse.json({
    ok: true,
    install: result.install,
    alreadyInstalled: result.alreadyInstalled,
    community,
  });
}
