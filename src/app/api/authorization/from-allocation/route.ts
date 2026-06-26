import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuthorizationsFromAllocation } from "@/lib/authorization/ledger";
import type { GitHubAllocationResult } from "@/lib/github/types";

const bodySchema = z.object({
  allocation: z.custom<GitHubAllocationResult>(),
  confidence: z.number().min(0).max(1).optional(),
});

/** Recognize owed amounts at analyze time — before settlement fulfillment. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocation" }, { status: 400 });
  }

  const result = await recordAuthorizationsFromAllocation(parsed.data.allocation, {
    confidence: parsed.data.confidence,
  });

  return NextResponse.json({
    missionId: result.missionId,
    authorizationCount: result.authorizations.length,
    totalAuthorizedUsd: result.authorizations.reduce((s, a) => s + a.amountUsd, 0),
    status: "authorized",
    message: "Contributors authorized. Settlement pending funding.",
  });
}
