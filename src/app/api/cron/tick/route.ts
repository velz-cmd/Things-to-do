import { NextResponse } from "next/server";
import { processScheduledTasks } from "@/lib/deputy/executor";
import { syncListenBrainzListens } from "@/lib/connectors/listenbrainz-sync";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { notifyAllUnnotifiedClaimable } from "@/lib/earn/notify";
import { refreshStaleSensors } from "@/lib/sensors/maintenance";

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tasks, music, sensors, notify] = await Promise.all([
    processScheduledTasks(),
    isListenBrainzConfigured() ? syncListenBrainzListens() : Promise.resolve(null),
    refreshStaleSensors().catch((e) => ({
      error: e instanceof Error ? e.message : "sensor_maintenance_failed",
    })),
    notifyAllUnnotifiedClaimable().catch((e) => ({
      error: e instanceof Error ? e.message : "notify_failed",
    })),
  ]);

  return NextResponse.json({
    ok: true,
    ...tasks,
    listenBrainz: music,
    sensors,
    earnNotify: Array.isArray(notify)
      ? { processed: notify.length, emailed: notify.filter((r) => r.emailSent).length }
      : notify,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
