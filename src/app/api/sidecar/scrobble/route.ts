import { NextResponse } from "next/server";
import { z } from "zod";
import { processScrobbleEvent } from "@/lib/sidecar/scrobble";

const bodySchema = z.object({
  musicbrainzId: z.string().min(4).optional(),
  mbid: z.string().min(4).optional(),
  artistName: z.string().optional(),
  trackTitle: z.string().optional(),
  durationSec: z.number().min(0),
  mediaFileId: z.string().optional(),
  listenerId: z.string().optional(),
  instanceUrl: z.string().url().optional(),
});

/**
 * Navidrome / Subsonic scrobble sidecar endpoint.
 * Attach as external scrobbler or POST plays from your listener app.
 * Skips plays under 30s (skip-as-royalty standard).
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scrobble payload" }, { status: 400 });
  }

  const mbid = parsed.data.musicbrainzId ?? parsed.data.mbid;
  const result = await processScrobbleEvent({
    musicbrainzId: mbid,
    artistName: parsed.data.artistName,
    trackTitle: parsed.data.trackTitle,
    durationSec: parsed.data.durationSec,
    mediaFileId: parsed.data.mediaFileId,
    listenerId: parsed.data.listenerId,
    instanceUrl: parsed.data.instanceUrl,
  });

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    name: "RESOLVE Scrobble Sidecar",
    description: "User-centric royalties — pay artists from your actual play history",
    minDurationSec: 30,
    endpoint: "POST /api/sidecar/scrobble",
    payeeRegistry: "GET /api/registry/musicbrainz/{mbid}",
    docs: "https://resolve-task.vercel.app/music",
  });
}
