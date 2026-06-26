import { NextResponse } from "next/server";
import {
  syncListenBrainzListens,
  getListenBrainzSyncStatus,
} from "@/lib/connectors/listenbrainz-sync";

function authorize(req: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.NAVIDROME_SYNC_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Pull Navidrome scrobbles via ListenBrainz — runs on Vercel with env credentials. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncListenBrainzListens();
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getListenBrainzSyncStatus();
  return NextResponse.json({ ok: true, ...status });
}
