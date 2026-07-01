import { NextResponse } from "next/server";
import { processScheduledTasks } from "@/lib/deputy/executor";
import { syncAllUsersSensors } from "@/lib/connectors/user-sensor-sync";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { notifyAllUnnotifiedClaimable } from "@/lib/earn/notify";
import { refreshStaleSensors } from "@/lib/sensors/maintenance";
import { refreshStaleEarningsSnapshots } from "@/lib/earn/earnings-snapshot";
import { refreshAllCommunityVitalsSnapshots } from "@/lib/communities/vitals-snapshot";
import { refreshOssOpportunityStore } from "@/lib/github/oss-scan-store";
import { releaseClaimableWithinTreasury } from "@/lib/treasury/claimable-release";

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tasks, userSensors, sensors, notify, claimableRelease, earningsSnapshots, vitalsSnapshots, ossScan] =
    await Promise.all([
    processScheduledTasks(),
    syncAllUsersSensors().catch((e) => ({
      error: e instanceof Error ? e.message : "user_sensor_sync_failed",
    })),
    refreshStaleSensors().catch((e) => ({
      error: e instanceof Error ? e.message : "sensor_maintenance_failed",
    })),
    notifyAllUnnotifiedClaimable().catch((e) => ({
      error: e instanceof Error ? e.message : "notify_failed",
    })),
    releaseClaimableWithinTreasury().catch((e) => ({
      error: e instanceof Error ? e.message : "claimable_release_failed",
    })),
    refreshStaleEarningsSnapshots(32).catch((e) => ({
      error: e instanceof Error ? e.message : "earnings_snapshot_failed",
    })),
    refreshAllCommunityVitalsSnapshots().catch((e) => ({
      error: e instanceof Error ? e.message : "vitals_snapshot_failed",
    })),
    refreshOssOpportunityStore().catch((e) => ({
      error: e instanceof Error ? e.message : "oss_scan_failed",
    })),
  ]);

  return NextResponse.json({
    ok: true,
    ...tasks,
    userSensors,
    sensors,
    earnNotify: Array.isArray(notify)
      ? { processed: notify.length, emailed: notify.filter((r) => r.emailSent).length }
      : notify,
    claimableRelease,
    earningsSnapshots,
    vitalsSnapshots,
    ossScan,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
