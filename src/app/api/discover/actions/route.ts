import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { executeDiscoverAction } from "@/lib/discover/discover-action-server";
import type { DiscoverActionKind } from "@/lib/discover/types";
import { isDbPoolExhaustedError } from "@/lib/db/connection";

export const maxDuration = 60;

const bodySchema = z.object({
  actionKind: z.string().min(1),
  actionId: z.string().optional(),
  label: z.string().optional(),
  communitySlug: z.string().optional(),
  programId: z.string().optional(),
  templateId: z.string().optional(),
  missionId: z.string().optional(),
  amountUsd: z.number().positive().optional(),
  entityId: z.string().optional(),
  href: z.string().optional(),
  role: z.string().optional(),
  surface: z.string().optional(),
});

/** Unified Discover action endpoint — always returns JSON. */
export async function POST(req: Request) {
  try {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", message: ready.error, nextAction: "sign_in" },
        { status: ready.status },
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: "INVALID_BODY", message: "Invalid action request" },
        { status: 400 },
      );
    }

    const result = await executeDiscoverAction(ready.user.id, {
      ...parsed.data,
      actionKind: parsed.data.actionKind as DiscoverActionKind,
    });

    const status = result.ok ? 200 : result.code === "AUTH_REQUIRED" ? 401 : 400;
    return NextResponse.json(result, { status: result.ok ? 200 : status });
  } catch (e) {
    console.error("[discover/actions]", e);
    const poolBusy = isDbPoolExhaustedError(e);
    const message = poolBusy
      ? "Database is busy. Try again, or open the community and continue setup there."
      : e instanceof Error
        ? e.message
        : "Action failed";
    return NextResponse.json(
      {
        ok: false,
        code: poolBusy ? "DATABASE_BUSY" : "SERVER_ERROR",
        message,
        nextAction: poolBusy ? "retry" : undefined,
      },
      { status: 500 },
    );
  }
}
