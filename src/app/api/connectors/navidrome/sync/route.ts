import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ingestNavidromeScrobbles,
  getNavidromeSyncStatus,
  recordNavidromeBridgeCursor,
} from "@/lib/connectors/navidrome-sync";

function authorize(req: Request): boolean {
  const secret =
    process.env.NAVIDROME_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const batchSchema = z.object({
  instanceId: z.string().optional(),
  perPlayUsd: z.number().positive().optional(),
  missionId: z.string().optional(),
  scrobbles: z.array(
    z.object({
      id: z.string().min(1),
      userId: z.string().min(1),
      mediaFileId: z.string().min(1),
      submissionTime: z.string().min(1),
      trackTitle: z.string().optional(),
      recordingMbid: z.string().optional(),
      artistName: z.string().optional(),
      durationSec: z.number().min(0).optional(),
    }),
  ),
});

/** Navidrome sync — POST scrobble batches from scripts/navidrome-bridge.ts on the Navidrome host. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = batchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid scrobble batch" }, { status: 400 });
    }

    const result = await ingestNavidromeScrobbles(parsed.data.scrobbles, {
      instanceId: parsed.data.instanceId,
      perPlayUsd: parsed.data.perPlayUsd,
      missionId: parsed.data.missionId,
    });

    const last = parsed.data.scrobbles[parsed.data.scrobbles.length - 1];
    if (last) {
      await recordNavidromeBridgeCursor(parsed.data.instanceId ?? "default", {
        submissionTime: last.submissionTime,
        id: last.id,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "batch",
      scanned: parsed.data.scrobbles.length,
      ingested: result.ingested,
      skipped: result.skipped,
      missionId: result.missionId,
    });
  }

  return NextResponse.json({
    error: "Send JSON scrobble batch from scripts/navidrome-bridge.ts",
    status: await getNavidromeSyncStatus(),
  }, { status: 400 });
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getNavidromeSyncStatus();
  return NextResponse.json({ status });
}
