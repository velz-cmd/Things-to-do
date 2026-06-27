import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { syncUserEcosystems } from "@/lib/mission/server/ecosystem-sync";

const schema = z.object({
  ecosystems: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.string().optional(),
        keywords: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await syncUserEcosystems(ready.user.id, parsed.data.ecosystems ?? []);
  return NextResponse.json({ ok: true });
}
