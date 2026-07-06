import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { processMissionMessage } from "@/lib/mission/server/process-message";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  messages: z.array(messageSchema).max(40).optional(),
  ecosystemId: z.string().optional(),
  operatingMode: z
    .enum(["founder", "dao", "maintainer", "creator", "research", "community_manager"])
    .optional(),
  fast: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
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
    const result = await processMissionMessage({
      userId: ready.user.id,
      missionId: id,
      question: parsed.data.question,
      messages: parsed.data.messages,
      ecosystemId: parsed.data.ecosystemId,
      operatingMode: parsed.data.operatingMode,
      fast: parsed.data.fast ?? true,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      evidenceAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mission message failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
