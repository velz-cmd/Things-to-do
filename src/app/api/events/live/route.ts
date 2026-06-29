import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { buildLiveEvents } from "@/lib/events/live";

/** Unified live event stream — ledger authorizations + community timeline. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const community = searchParams.get("community");
  const mission = searchParams.get("mission");
  const status = searchParams.get("status");
  const scope = searchParams.get("scope") === "mine" ? "mine" : "network";
  const limit = Number(searchParams.get("limit") ?? "24");

  const authUser = await getSessionUser();

  try {
    const payload = await buildLiveEvents({
      limit: Number.isFinite(limit) ? limit : 24,
      domain: domain || null,
      communitySlug: community || null,
      missionId: mission || null,
      status: status || null,
      userId: authUser?.id ?? null,
      scope,
    });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[events/live]", e);
    return NextResponse.json(
      { ok: false, error: "Could not load live events" },
      { status: 500 },
    );
  }
}
