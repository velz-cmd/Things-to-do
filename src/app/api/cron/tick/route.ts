import { NextResponse } from "next/server";
import { processScheduledTasks } from "@/lib/deputy/executor";
import { syncListenBrainzListens } from "@/lib/connectors/listenbrainz-sync";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { getCronSecret } from "@/lib/env/cron-secret";

export async function GET(req: Request) {
  const secret = getCronSecret();
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tasks, music] = await Promise.all([
    processScheduledTasks(),
    isListenBrainzConfigured() ? syncListenBrainzListens() : Promise.resolve(null),
  ]);

  return NextResponse.json({ ok: true, ...tasks, listenBrainz: music });
}

export async function POST(req: Request) {
  return GET(req);
}
