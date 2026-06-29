import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { syncUserGithubIdentity } from "@/lib/identity/contributors";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";

/** Sync Supabase GitHub OAuth identity → User + ContributorRegistry */
export async function POST() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  await ensureProfileForUser(session.user);
  const login = await syncUserGithubIdentity(session.user.id, session.user);
  void syncUserSensors(session.user.id).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    githubUsername: login,
    linked: Boolean(login),
  });
}
