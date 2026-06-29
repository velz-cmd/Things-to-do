import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { prisma } from "@/lib/db";

/** Bridge health for music communities — mission ID from install, not manual env copy. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const communitySlug = searchParams.get("community") ?? "independent-music";

  const authUser = await getSessionUser();
  const global = await getNavidromeSyncStatus();

  let installMissionId: string | null = null;
  let programName: string | null = null;
  let installed = false;

  if (authUser) {
    const install = await prisma.resolveCommunityInstall.findFirst({
      where: { userId: authUser.id, communitySlug },
      orderBy: { installedAt: "desc" },
    });
    installed = Boolean(install);

    if (install) {
      const program = await prisma.resolveProgram.findFirst({
        where: { installId: install.id, missionId: { not: null } },
        orderBy: { updatedAt: "desc" },
      });
      installMissionId = program?.missionId ?? null;
      programName = program?.name ?? null;
    }
  }

  const bridgeHealthy = Boolean(global.cursor?.lastSubmissionTime);
  const lastSync = global.cursor?.lastSubmissionTime ?? null;

  return NextResponse.json({
    ok: true,
    mode: "bridge",
    installed,
    bridgeHealthy,
    lastSyncAt: lastSync,
    instanceId: global.instanceId,
    perPlayUsd: global.perPlayUsd,
    syncEndpoint: global.syncEndpoint,
    bridgeScript: global.bridgeScript,
    program: installMissionId
      ? { missionId: installMissionId, name: programName, communitySlug }
      : null,
    envMissionId: process.env.NAVIDROME_PROGRAM_MISSION_ID?.trim() || null,
    instructions: installed
      ? "Run scripts/navidrome-bridge.ts on your Navidrome host — mission ID is resolved from your install automatically."
      : "Install the music community first; RESOLVE will assign a program mission ID.",
  });
}
