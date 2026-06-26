import { NextResponse } from "next/server";
import { z } from "zod";
import { navidromeScrobbleToSettlementEvents } from "@/lib/connectors/navidrome";
import { ingestSettlementInput } from "@/lib/authorization/ledger";

const bodySchema = z.object({
  mediaFileId: z.string().min(1),
  userId: z.string().min(1),
  submissionTime: z.string().min(1),
  artistName: z.string().optional(),
  trackTitle: z.string().optional(),
  recordingMbid: z.string().optional(),
  durationSec: z.number().min(0).optional(),
  instanceId: z.string().optional(),
});

/** Music play → MusicBrainz credits → Authorization Ledger */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scrobble payload" }, { status: 400 });
  }

  const events = await navidromeScrobbleToSettlementEvents(parsed.data);
  if (!events.length) {
    return NextResponse.json({
      authorized: false,
      reason: "Play under 30 second gate",
    });
  }

  const results = [];
  for (const event of events) {
    const result = await ingestSettlementInput(event);
    if (!result.skipped) results.push(result.authorization);
  }

  if (!results.length) {
    return NextResponse.json({ authorized: false, reason: "duplicate_or_zero" });
  }

  const totalUsd = results.reduce((s, r) => s + r.amountUsd, 0);
  return NextResponse.json({
    authorized: true,
    creditCount: results.length,
    authorizationIds: results.map((r) => r.id),
    amountUsd: Math.round(totalUsd * 10000) / 10000,
    status: results[0]!.status,
    missionId: results[0]!.missionId,
    message: "Settlement pending funding.",
  });
}
