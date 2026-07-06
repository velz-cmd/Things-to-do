import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { syncMissionSession } from "@/lib/mission/server/missions";
import type { MissionStatus } from "@/lib/mission/state-machine";

const turnSchema = z.object({
  role: z.enum(["user", "resolve"]),
  text: z.string().max(16000),
  phase: z.string().optional(),
  capability: z.string().optional(),
  findings: z.array(z.unknown()).optional(),
  actions: z.array(z.unknown()).optional(),
  report: z.record(z.string(), z.unknown()).optional(),
      payload: z
    .object({
      blueprint: z
        .object({
          prompt: z.string(),
          initialBudgetUsd: z.number().optional(),
        })
        .optional(),
      agentSignal: z
        .object({
          prompt: z.string(),
          serviceId: z.string().optional(),
        })
        .optional(),
      fulfillPool: z
        .object({
          prompt: z.string(),
          communitySlug: z.string().optional(),
        })
        .optional(),
      personalPool: z
        .object({
          prompt: z.string(),
          initialBudgetUsd: z.number().optional(),
        })
        .optional(),
      communalPool: z
        .object({
          prompt: z.string(),
          communitySlug: z.string().optional(),
        })
        .optional(),
      batchAllocation: z
        .object({
          prompt: z.string(),
          communitySlug: z.string().optional(),
          initialBudgetUsd: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  scope: z.string().max(4000).optional(),
  status: z.string().optional(),
  phase: z.string().optional(),
  capability: z.string().optional(),
  ecosystemId: z.string().optional(),
  findingCount: z.number().int().optional(),
  turns: z.array(turnSchema).max(80),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const mission = await syncMissionSession(ready.user.id, id, {
      ...parsed.data,
      status: parsed.data.status as MissionStatus | undefined,
      phase: parsed.data.phase as import("@/lib/mission/phases").MissionPhase | undefined,
      turns: parsed.data.turns.map((t) => ({
        role: t.role,
        text: t.text,
        phase: t.phase as import("@/lib/mission/phases").MissionPhase | undefined,
        capability: t.capability,
        findings: t.findings as import("@/lib/workspace/advisors/intelligence-findings").MissionFinding[] | undefined,
        actions: t.actions as import("@/lib/mission/capabilities/types").CapabilityAction[] | undefined,
        report: t.report as import("@/lib/mission/mission-report").MissionReport | undefined,
        payload: t.payload,
      })),
    });
    return NextResponse.json({ ok: true, mission });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
