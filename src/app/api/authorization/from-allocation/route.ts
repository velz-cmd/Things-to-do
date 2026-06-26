import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { githubAllocationToSettlementInputs } from "@/lib/connectors/github";
import type { GitHubAllocationResult } from "@/lib/github/types";

const bodySchema = z.object({
  allocation: z.custom<GitHubAllocationResult>(),
});

/** GitHub allocation → Authorization Ledger (connector-agnostic ingest). */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocation" }, { status: 400 });
  }

  const events = githubAllocationToSettlementInputs(parsed.data.allocation);
  const result = await ingestSettlementBatch(events);

  return NextResponse.json({
    missionId: result.missionId,
    authorizationCount: result.count,
    totalAuthorizedUsd: result.totalUsd,
    status: "authorized",
    message: "Settlement pending funding.",
  });
}
