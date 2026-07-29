import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { missionOperationRequestSchema, resolveChatResponseSchema } from "@/lib/mission/structured-contract";
import {
  getStructuredMission,
  runStructuredMissionOperation,
} from "@/lib/mission/server/structured-engine";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const ready = await requireSessionUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const body = await request.json().catch(() => null);
  const parsed = missionOperationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "The requested Mission operation is invalid.",
      issues: parsed.error.issues,
    }, { status: 400 });
  }
  const { id } = await params;
  try {
    const workflow = await runStructuredMissionOperation({
      userId: ready.user.id,
      missionId: id,
      request: parsed.data,
    });
    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission operation failed.";
    const status = message === "Mission not found." ? 404 : 409;
    const workflow = status === 404 ? null : await getStructuredMission(ready.user.id, id).catch(() => null);
    if (workflow) {
      workflow.response = resolveChatResponseSchema.parse({
        ...workflow.response,
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          summary: "The operation was not applied. Confirmed Mission state is unchanged.",
          details: message,
          createdAt: new Date().toISOString(),
        },
        cards: [
          ...(workflow.response.cards ?? []).slice(-4),
          {
            id: crypto.randomUUID(),
            type: "operation_failure",
            title: "Operation needs attention",
            operationType: parsed.data.operationType,
            message,
            retryable: true,
            recoveryOperationType: parsed.data.operationType,
          },
        ],
      });
    }
    return NextResponse.json({
      error: message,
      recovery: "Refresh the mission and choose one of the currently enabled actions.",
      workflow,
    }, { status });
  }
}
