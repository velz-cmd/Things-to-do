import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { createEcosystem, listEcosystems } from "@/lib/mission/server/ecosystems";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.string().max(40).optional(),
});

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const ecosystems = await listEcosystems(ready.user.id);
  return NextResponse.json({ ok: true, ecosystems });
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

  const ecosystem = await createEcosystem(ready.user.id, parsed.data.name, parsed.data.kind);
  return NextResponse.json({ ok: true, ecosystem });
}
