import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import {
  finalizeAllPendingArcFundsForUser,
  finalizePendingFundActivity,
} from "@/lib/capital/fund-program-finalize";
import { bustCapitalStateCache } from "@/lib/capital/state-cache";

export const maxDuration = 60;

const bodySchema = z.object({
  activityId: z.string().min(1).optional(),
});

/** Poll / recover pending Arc pool funds — completes or reverses based on Circle state. */
export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: ready.error }, { status: ready.status });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const userId = ready.profile.id;

    if (parsed.data.activityId) {
      const result = await finalizePendingFundActivity({
        userId,
        activityId: parsed.data.activityId,
        waitMs: 12_000,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await bustCapitalStateCache(userId);
      return NextResponse.json(result);
    }

    const resolved = await finalizeAllPendingArcFundsForUser(userId);
    await bustCapitalStateCache(userId);
    return NextResponse.json({ ok: true, resolved });
  } catch (e) {
    console.error("[capital/fund/finalize]", e);
    return NextResponse.json({ error: "Could not finalize pending fund" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
