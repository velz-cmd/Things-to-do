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

const batchSchema = z.object({
  userId: z.string().min(1),
  watches: z.array(
    z.object({
      itemId: z.string().min(1),
      watchedAt: z.string().min(1),
      title: z.string().min(1),
      mediaType: z.string().optional(),
      creatorName: z.string().optional(),
      durationSec: z.number().min(0).optional(),
      instanceId: z.string().optional(),
    }),
  ),
});

/** Jellyfin bridge — POST watch batches from scripts/jellyfin-bridge.ts on the Jellyfin host. */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Send JSON watch batch from scripts/jellyfin-bridge.ts" },
      { status: 400 },
    );
  }

  const parsed = batchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Jellyfin watch batch" }, { status: 400 });
  }

  if (authorizeBridge(req)) {
    const result = await ingestJellyfinWatches(
      parsed.data.userId,
      parsed.data.watches.map((w) => ({ ...w, userId: parsed.data.userId })),
    );
    return NextResponse.json({
      ok: true,
      mode: "bridge",
      scanned: parsed.data.watches.length,
      ingested: result.ingested,
      watches: result.watches,
      missionId: result.missionId,
    });
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  if (ready.user.id !== parsed.data.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await ingestJellyfinWatches(
    ready.user.id,
    parsed.data.watches.map((w) => ({ ...w, userId: ready.user.id })),
  );

  return NextResponse.json({
    ok: true,
    mode: "session",
    scanned: parsed.data.watches.length,
    ingested: result.ingested,
    watches: result.watches,
    missionId: result.missionId,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    bridge: "scripts/jellyfin-bridge.ts",
    syncUrl: "/api/connectors/jellyfin/sync",
    auth: "Bearer JELLYFIN_SYNC_SECRET (or CRON_SECRET)",
  });
}
