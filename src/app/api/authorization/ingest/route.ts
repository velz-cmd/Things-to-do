import { NextResponse } from "next/server";
import { z } from "zod";
import type { SettlementInputEvent } from "@/lib/authorization/types";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";

const eventSchema = z.object({
  connectorId: z.string(),
  eventType: z.string(),
  occurredAt: z.string(),
  missionId: z.string(),
  idempotencyKey: z.string(),
  payeeKeyType: z.string(),
  payeeKey: z.string(),
  amountUsd: z.number().positive(),
  weight: z.number().optional(),
  proofHash: z.string(),
  confidence: z.number().optional(),
  contextLabel: z.string().optional(),
  evidenceRefs: z.array(z.string()),
  rawMetadata: z.unknown().optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1),
});

/** Generic Distribution Connector ingest → Authorization Ledger */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settlement input events" }, { status: 400 });
  }

  const result = await ingestSettlementBatch(parsed.data.events as SettlementInputEvent[]);
  return NextResponse.json({
    missionId: result.missionId,
    authorizationCount: result.count,
    totalAuthorizedUsd: result.totalUsd,
    status: "authorized",
    message: "Settlement pending funding.",
  });
}
