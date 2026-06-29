import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { getUserMusicSensorStatus } from "@/lib/connectors/user-music-sync";
import { prisma } from "@/lib/db";

/** Music sensor health — user-friendly, no bridge scripts. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const communitySlug = searchParams.get("community") ?? "independent-music";

  const authUser = await getSessionUser();
  const global = await getNavidromeSyncStatus();

  let installMissionId: string | null = null;
  let programName: string | null = null;
  let installed = false;
  let userSensor = {
    listenBrainzConnected: false,
    navidromeConnected: false,
    receiving: false,
    lastSyncAt: null as string | null,
    mode: "cloud" as const,
  };

  if (authUser) {
    userSensor = await getUserMusicSensorStatus(authUser.id);

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

  const lastSync =
    userSensor.lastSyncAt ?? global.cursor?.lastSubmissionTime ?? null;
  const receiving =
    userSensor.receiving || Boolean(global.cursor?.lastSubmissionTime);

  let instructions: string;
  if (!installed) {
    instructions =
      "Install this music community — then connect ListenBrainz on Profile. RESOLVE watches your plays automatically.";
  } else if (userSensor.listenBrainzConnected) {
    instructions =
      "ListenBrainz connected. RESOLVE syncs your plays in the background — just keep listening.";
  } else if (userSensor.navidromeConnected) {
    instructions =
      "Navidrome connected. RESOLVE polls your library from the cloud when it is reachable.";
  } else {
    instructions =
      "Open Profile → connect ListenBrainz (recommended). If Navidrome scrobbles to ListenBrainz, plays appear here with no extra setup.";
  }

  return NextResponse.json({
    ok: true,
    mode: "cloud",
    installed,
    receiving,
    bridgeHealthy: receiving,
    lastSyncAt: lastSync,
    perPlayUsd: global.perPlayUsd,
    program: installMissionId
      ? { missionId: installMissionId, name: programName, communitySlug }
      : null,
    sensors: {
      listenBrainz: userSensor.listenBrainzConnected,
      navidrome: userSensor.navidromeConnected,
    },
    instructions,
  });
}
