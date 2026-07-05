import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { fundCommunityProgramWithTx } from "@/lib/capital/fund-program-with-tx";

export const maxDuration = 60;

const bodySchema = z.object({
  programId: z.string().min(1),
  amountUsd: z.number().positive(),
  txHash: z.string().min(1),
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
      return NextResponse.json({ error: "Amount can't be less than $5" }, { status: 400 });
    }

    const result = await fundCommunityProgramWithTx({
      userId: ready.profile.id,
      programId: parsed.data.programId,
      amountUsd: parsed.data.amountUsd,
      txHash: parsed.data.txHash,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[capital/fund-with-tx]", e);
    return NextResponse.json({ error: "On-chain fund failed" }, { status: 500 });
  }
}
