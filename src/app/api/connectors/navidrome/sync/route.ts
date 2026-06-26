import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ingestNavidromeScrobbles,
  syncNavidromeFromSqlite,
  getNavidromeSyncStatus,
} from "@/lib/connectors/navidrome-sync";

function authorize(req: Request): boolean {
  const secret =
    process.env.NAVIDROME_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const batchSchema = z.object({
  instanceId: z.string().optional(),
  perPlayUsd: z.number().positive().optional(),
  scrobbles: z.array(
    z.object({
      id: z.string().min(1),
      userId: z.string().min(1),
      mediaFileId: z.string().min(1),
      submissionTime: z.string().min(1),
      artistName: z.string().optional(),
      durationSec: z.number().min(0).optional(),
    }),
  ),
});

/** Navidrome automatic sync — SQLite tail locally or push batch from bridge script. */
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
    });

    return NextResponse.json({
      ok: true,
      mode: "batch",
      scanned: parsed.data.scrobbles.length,
      ingested: result.ingested,
      skipped: result.skipped,
    });
  }

  const result = await syncNavidromeFromSqlite();
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getNavidromeSyncStatus();
  if (req.headers.get("x-sync-trigger") === "1") {
    const result = await syncNavidromeFromSqlite();
    return NextResponse.json({ status, sync: result });
  }

  return NextResponse.json({ status });
}
