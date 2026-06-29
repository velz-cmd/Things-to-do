import { NextResponse } from "next/server";
import { getSessionUser, requireReadyUser } from "@/lib/auth/session";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { syncAllUsersSensors, syncUserSensors } from "@/lib/connectors/user-sensor-sync";

/** Global per-user sensor sync — music, GitHub, OpenAlex. Works for any signed-in user worldwide. */
export async function POST(req: Request) {
  if (authorizeCronRequest(req)) {
    const result = await syncAllUsersSensors();
    return NextResponse.json(result);
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const result = await syncUserSensors(ready.user.id);
  return NextResponse.json(result);
}

export async function GET() {
  const authUser = await getSessionUser();
  return NextResponse.json({
    ok: true,
    mode: "per_user",
    description:
      "Each user connects via OAuth on Profile. RESOLVE syncs their communities automatically — no operator scripts.",
    endpoints: {
      sync: "POST /api/connectors/sensors/sync",
      music: "POST /api/connectors/music/sync",
      github: "POST /api/connectors/github/sync",
      listenbrainz: "GET /api/connectors/listenbrainz/authorize",
    },
    signedIn: Boolean(authUser),
  });
}
