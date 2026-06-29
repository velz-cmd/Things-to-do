import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { syncUserGithubIdentity } from "@/lib/identity/contributors";
import { syncUserSensors } from "@/lib/connectors/user-sensor-sync";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { prisma } from "@/lib/db";

/** Sync Supabase GitHub OAuth identity → User + ContributorRegistry */
export async function POST() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  await ensureProfileForUser(session.user);
  const login = await syncUserGithubIdentity(session.user.id, session.user);

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { githubUsername: true, listenbrainzUsername: true },
  });
  if (profile) {
    void autoInstallCommunitiesForUser(session.user.id, profile).catch(() => undefined);
  }

  void syncUserSensors(session.user.id).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    githubUsername: login,
    linked: Boolean(login),
  });
}
