import { NextResponse } from "next/server";
import { buildDiscoverRadar } from "@/lib/discover/radar";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";
import {
  claimTokenSecretHasWhitespace,
  cronSecretHasWhitespace,
  getClaimTokenSecret,
  getCronSecret,
} from "@/lib/env/cron-secret";

/** Live data fingerprint — radar activity count + sensor status (public, no secrets). */
export async function GET() {
  const [radar, sensors] = await Promise.all([
    buildDiscoverRadar().catch(() => null),
    getCommunitySensorStatuses().catch(() => []),
  ]);

  const activityCount = radar?.activity.length ?? 0;
  const latestAt = radar?.activity[0]?.at ?? null;
  const year =
    latestAt ? new Date(latestAt).getUTCFullYear() : new Date().getUTCFullYear();

  return NextResponse.json({
    ok: true,
    live: activityCount > 0,
    activityCount,
    latestEventAt: latestAt,
    dataYear: year,
    updatedAt: radar?.updatedAt ?? new Date().toISOString(),
    sensors: sensors.map((s) => ({
      slug: s.slug,
      sensorLive: s.sensorLive,
      sensorGated: s.sensorGated,
      message: s.message,
    })),
    secrets: {
      cronConfigured: Boolean(getCronSecret()),
      cronRuntimeOk: Boolean(getCronSecret()),
      claimTokenConfigured: Boolean(getClaimTokenSecret()),
      cronWhitespace: cronSecretHasWhitespace(),
      claimTokenWhitespace: claimTokenSecretHasWhitespace(),
    },
    emptyReason: radar?.emptyReason ?? null,
  });
}
