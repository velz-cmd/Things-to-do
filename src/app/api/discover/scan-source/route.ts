import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { executeDiscoverAction } from "@/lib/discover/discover-action-server";

const bodySchema = z.object({
  communitySlug: z.string().optional(),
  entityId: z.string().optional(),
  label: z.string().optional(),
  surface: z.string().optional(),
});

/** Scan/import activity from a connected proof source. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", message: ready.error },
      { status: ready.status },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Invalid scan request" },
      { status: 400 },
    );
  }

  const result = await executeDiscoverAction(ready.user.id, {
    actionKind: "analyze",
    communitySlug: parsed.data.communitySlug,
    entityId: parsed.data.entityId,
    label: parsed.data.label ?? "Scan activity",
    surface: parsed.data.surface,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
