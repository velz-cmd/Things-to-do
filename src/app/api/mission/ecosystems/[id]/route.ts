import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { getEcosystem } from "@/lib/mission/server/ecosystems";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;
  const ecosystem = await getEcosystem(ready.user.id, id);
  if (!ecosystem) {
    return NextResponse.json({ error: "Ecosystem not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ecosystem });
}
