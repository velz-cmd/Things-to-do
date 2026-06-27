import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { createKnowledgeEntry, listKnowledge } from "@/lib/mission/server/knowledge";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  kind: z.string().max(40).optional(),
  source: z.string().max(120).optional(),
  ecosystemId: z.string().optional(),
  missionId: z.string().optional(),
});

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const knowledge = await listKnowledge(ready.user.id);
  return NextResponse.json({ ok: true, knowledge });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const entry = await createKnowledgeEntry(ready.user.id, parsed.data);
  return NextResponse.json({ ok: true, entry });
}
