import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { ingestSettlementInput } from "@/lib/authorization/ledger";

const bodySchema = z.object({
  programId: z.string().min(1),
});

/**
 * Playwright-only — seeds one authorization so /receipt/[id] proof is testable after fund.
 * Guarded by PLAYWRIGHT_ENABLED=true (set in CI workflow).
 */
export async function POST(req: Request) {
  if (process.env.PLAYWRIGHT_ENABLED !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid proof request" }, { status: 400 });
  }

  const program = await prisma.resolveProgram.findUnique({
    where: { id: parsed.data.programId },
    select: { id: true, missionId: true, name: true },
  });
  if (!program?.missionId) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const idempotencyKey = `e2e-proof:${program.id}:${ready.profile.id}`;
  const result = await ingestSettlementInput(
    {
      connectorId: "github",
      eventType: "contribution.merge",
      missionId: program.missionId,
      idempotencyKey,
      payeeKeyType: "github_user",
      payeeKey: "e2e-contributor",
      amountUsd: 5,
      proofHash: `e2e-proof-${program.id}`,
      contextLabel: `E2E proof · ${program.name}`,
      evidenceRefs: [],
      occurredAt: new Date().toISOString(),
    },
    { founderUserId: ready.profile.id, status: "authorized" },
  );

  if (result.skipped || !result.authorization) {
    return NextResponse.json({ error: "Could not create proof" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    receiptId: result.authorization.id,
    receiptUrl: `/receipt/${result.authorization.id}`,
  });
}
