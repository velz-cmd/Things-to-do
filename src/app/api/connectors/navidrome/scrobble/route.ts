import { NextResponse } from "next/server";
import { z } from "zod";
import { scrobbleToSettlementEvent } from "@/lib/connectors/navidrome";

const bodySchema = z.object({
  mediaFileId: z.string().min(1),
  userId: z.string().min(1),
  submissionTime: z.string().min(1),
  artistName: z.string().optional(),
  durationSec: z.number().min(0).optional(),
});

/** Demo: Navidrome scrobble → authorization event (Distribution Connector #2). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scrobble payload" }, { status: 400 });
  }

  const event = scrobbleToSettlementEvent(parsed.data);

  if (event.amountUsd <= 0) {
    return NextResponse.json({
      authorized: false,
      reason: "Play under 30s gate",
      event,
    });
  }

  return NextResponse.json({
    authorized: true,
    amountUsd: event.amountUsd,
    status: "authorized",
    message: "Listen authorized. Settlement pending funding.",
    event,
  });
}
