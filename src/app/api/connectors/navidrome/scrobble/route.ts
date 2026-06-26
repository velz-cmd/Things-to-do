import { NextResponse } from "next/server";
import { z } from "zod";
import { navidromeScrobbleToSettlementInput } from "@/lib/connectors/navidrome";
import { ingestSettlementInput } from "@/lib/authorization/ledger";

const bodySchema = z.object({
  mediaFileId: z.string().min(1),
  userId: z.string().min(1),
  submissionTime: z.string().min(1),
  artistName: z.string().optional(),
  durationSec: z.number().min(0).optional(),
  instanceId: z.string().optional(),
});

/** Navidrome Distribution Connector — scrobble → Authorization Ledger */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scrobble payload" }, { status: 400 });
  }

  const event = navidromeScrobbleToSettlementInput(parsed.data);
  if (!event) {
    return NextResponse.json({
      authorized: false,
      reason: "Play under 30 second gate",
    });
  }

  const result = await ingestSettlementInput(event);
  if (result.skipped) {
    return NextResponse.json({ authorized: false, reason: result.reason });
  }

  return NextResponse.json({
    authorized: true,
    authorizationId: result.authorization.id,
    amountUsd: result.authorization.amountUsd,
    status: result.authorization.status,
    missionId: result.authorization.missionId,
    message: "Settlement pending funding.",
  });
}
