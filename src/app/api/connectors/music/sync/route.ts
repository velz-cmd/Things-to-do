import { NextResponse } from "next/server";
import { getSessionUser, requireReadyUser } from "@/lib/auth/session";
import {
  getUserMusicSensorStatus,
  syncAllUsersMusicSensors,
  syncUserMusicSensors,
} from "@/lib/connectors/user-music-sync";
import { authorizeCronRequest } from "@/lib/env/cron-secret";

/** Cloud music sensor — syncs ListenBrainz / Navidrome for the signed-in user. */
export async function POST(req: Request) {
  const cron = authorizeCronRequest(req);
  if (cron) {
    const result = await syncAllUsersMusicSensors();
    return NextResponse.json(result);
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const result = await syncUserMusicSensors(ready.user.id);
  return NextResponse.json(result);
}

export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      receiving: false,
      message: "Sign in to connect ListenBrainz or Navidrome on Profile.",
    });
  }

  const status = await getUserMusicSensorStatus(authUser.id);
  return NextResponse.json({
    ok: true,
    signedIn: true,
    ...status,
    message: status.receiving
      ? "RESOLVE is watching your listening activity automatically."
      : status.listenBrainzConnected || status.navidromeConnected
        ? "Connected — your next listens will appear here within a few minutes."
        : "Connect ListenBrainz on Profile to start. No setup or code required.",
  });
}
