import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { fundCommunityProgram } from "@/lib/capital/fund-program";

const bodySchema = z.object({
  programId: z.string().min(1),
  amountUsd: z.number().positive(),
  targetYieldMultiplier: z.number().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fund request" }, { status: 400 });
  }

  const result = await fundCommunityProgram({
    userId: ready.profile.id,
    programId: parsed.data.programId,
    amountUsd: parsed.data.amountUsd,
    targetYieldMultiplier: parsed.data.targetYieldMultiplier,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
