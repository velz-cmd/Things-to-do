import { NextResponse } from "next/server";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";

/** Legacy cron path — Navidrome sync uses bridge script, not Vercel cron (Hobby = daily only). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getNavidromeSyncStatus();
  return NextResponse.json({
    ok: true,
    message:
      "Navidrome sync is not scheduled on Vercel. Run scripts/navidrome-bridge.ts on your Navidrome host, or use cron-job.org to POST batches to /api/connectors/navidrome/sync.",
    status,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
