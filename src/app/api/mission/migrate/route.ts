import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { migrateLocalSessions } from "@/lib/mission/server/missions";

const sessionSchema = z.object({
  title: z.string(),
  query: z.string(),
  ecosystemId: z.string().optional(),
  turns: z
    .array(
      z.object({
        role: z.string(),
        text: z.string(),
      }),
    )
    .optional(),
});

const bodySchema = z.object({
  sessions: z.array(sessionSchema).max(32),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await migrateLocalSessions(ready.user.id, parsed.data.sessions);
  return NextResponse.json({ ok: true, ...result });
}
