import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { ingestJellyfinWatches } from "@/lib/connectors/user-jellyfin-sync";

function authorizeBridge(req: Request): boolean {
  const secret =
    process.env.JELLYFIN_SYNC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const watchSchema = z.object({
  itemId: z.string().min(1),
  watchedAt: z.string().min(1),
  title: z.string().min(1),
  mediaType: z.string().optional(),
  creatorName: z.string().optional(),
  durationSec: z.number().min(0).optional(),
  instanceId: z.string().optional(),
});

const batchSchema = z.object({
  userId: z.string().min(1).optional(),
  watches: z.array(watchSchema),
});

/** Ingest Jellyfin watches — browser session (Profile) or optional bridge secret. */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Jellyfin watch batch" }, { status: 400 });
  }

  if (!parsed.data.watches.length) {
    return NextResponse.json({ ok: true, ingested: 0, watches: 0 });
  }

  let userId = parsed.data.userId;
  let mode: "bridge" | "session" = "session";

  if (authorizeBridge(req) && userId) {
    mode = "bridge";
  } else {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: ready.error }, { status: ready.status });
    }
    if (userId && userId !== ready.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userId = ready.user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ingestJellyfinWatches(
    userId,
    parsed.data.watches.map((w) => ({ ...w, userId })),
  );

  return NextResponse.json({
    ok: true,
    mode,
    scanned: parsed.data.watches.length,
    ingested: result.ingested,
    watches: result.watches,
    missionId: result.missionId,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, syncUrl: "/api/connectors/jellyfin/sync" });
}
