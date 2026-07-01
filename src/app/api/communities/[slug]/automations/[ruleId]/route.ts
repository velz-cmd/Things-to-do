import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { updateAutomationRule } from "@/lib/automation/rules";

type Params = { params: Promise<{ slug: string; ruleId: string }> };

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  authorizeUsd: z.number().positive().optional(),
  notifyTarget: z.string().min(3).max(500).optional(),
  notifyChannel: z.enum(["email", "webhook"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { ruleId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const result = await updateAutomationRule(ready.user.id, ruleId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, rule: result.rule });
}
