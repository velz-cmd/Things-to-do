import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { seedProductionArtistRegistry } from "@/lib/registry/production-artists";

/** Seed production artist → wallet rows for deploy payee resolution. Cron-auth only. */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedProductionArtistRegistry();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/registry/seed-production",
    env: "PRODUCTION_ARTIST_REGISTRY (optional JSON override)",
    hint: "Seeds real MusicBrainz artist rows with wallets — not demo fake MBIDs",
  });
}
