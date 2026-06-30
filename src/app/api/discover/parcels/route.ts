import { NextResponse } from "next/server";
import { discoverParcels } from "@/lib/discover/discovery-service";
import { getSessionUserId } from "@/lib/auth/session";

/** @deprecated Hackathon demo — not used by Discover tab. Quarantined for legacy deputy flows. */
export async function POST() {
  const userId = await getSessionUserId();
  const result = await discoverParcels(userId);
  return NextResponse.json(
    { ...result, deprecated: true, migrateTo: "/api/discover/radar-feed" },
    { headers: { "X-Deprecated": "discover-parcels-demo" } },
  );
}
