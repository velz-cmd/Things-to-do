import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { resolveFundTarget } from "@/lib/discover/fund-target";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const programId = sp.get("programId") ?? undefined;
  const communitySlug = sp.get("communitySlug") ?? undefined;
  const templateId = sp.get("templateId") ?? undefined;
  const missionId = sp.get("missionId") ?? undefined;

  if (!programId && !communitySlug && !missionId) {
    return NextResponse.json({ error: "Missing fund target" }, { status: 400 });
  }

  const sessionUser = await getSessionUser();
  const userId = sessionUser ? (await ensureProfileForUser(sessionUser)).id : null;

  try {
    const target = await resolveFundTarget({
      programId,
      communitySlug,
      templateId,
      missionId,
      userId,
    });
    if (!target) {
      return NextResponse.json({ error: "Fund target not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, target });
  } catch (e) {
    console.error("[discover/fund-target]", e);
    return NextResponse.json({ error: "Could not resolve fund target" }, { status: 500 });
  }
}
