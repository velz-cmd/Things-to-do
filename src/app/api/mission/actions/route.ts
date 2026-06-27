import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { dispatchMissionAction } from "@/lib/mission/server/dispatch-action";
import { getMission } from "@/lib/mission/server/missions";

const actionSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  kind: z.enum(["explore", "simulate", "plan", "execute", "remember", "navigate"]),
  href: z.string().optional(),
  actionType: z
    .enum([
      "chat",
      "navigate",
      "prepare_settlement",
      "execute_settlement",
      "save_knowledge",
      "open_claim",
      "fund_treasury",
      "github_allocate",
    ])
    .optional(),
});

const bodySchema = z.object({
  missionId: z.string().min(1),
  action: actionSchema,
  context: z
    .object({
      objective: z.string().optional(),
      summary: z.string().optional(),
      headline: z.string().optional(),
      ecosystemId: z.string().optional(),
      fundPoolUsd: z.number().positive().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
    })
    .optional(),
});

/** Execute a real mission action from chat — settlement, knowledge, navigation, etc. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mission = await getMission(ready.user.id, parsed.data.missionId);
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  try {
    const result = await dispatchMissionAction({
      userId: ready.user.id,
      missionId: parsed.data.missionId,
      action: parsed.data.action,
      context: parsed.data.context,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
