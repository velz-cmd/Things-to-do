import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";

/** Legacy endpoint — GitHub connector uses /api/connectors/github/authorize now. */
export async function POST() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const profile = await ensureProfileForUser(session.user);

  return NextResponse.json({
    ok: true,
    githubUsername: profile.githubUsername,
    linked: Boolean(profile.githubUsername),
    authorizeUrl: "/api/connectors/github/authorize?returnTo=/profile",
  });
}
