import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { fundCommunityProgram } from "@/lib/capital/fund-program";

export const maxDuration = 60;

function publicFundError(error: unknown) {
  const message = error instanceof Error ? error.message : "Fund failed";
  if (
    /connection pool|prisma|timeout|timed out|database|ECONNRESET|fetch failed/i.test(message)
  ) {
    return "Funding is still syncing. Open Capital for status, then retry if it does not appear.";
  }
  return message;
}

const bodySchema = z.object({
  programId: z.string().min(1),
  amountUsd: z.number().positive(),
  targetYieldMultiplier: z.number().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: ready.error }, { status: ready.status });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid fund request" }, { status: 400 });
    }

    if (parsed.data.amountUsd < 5) {
      return NextResponse.json(
        { error: "Amount can't be less than $5" },
        { status: 400 },
      );
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
  } catch (e) {
    console.error("[capital/fund]", e);
    return NextResponse.json({ error: publicFundError(e) }, { status: 500 });
  }
}
