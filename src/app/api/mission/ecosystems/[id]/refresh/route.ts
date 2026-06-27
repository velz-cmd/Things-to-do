import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { refreshEcosystemRepos } from "@/lib/mission/server/ecosystems";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;

  try {
    const ecosystem = await refreshEcosystemRepos(ready.user.id, id);
    return NextResponse.json({ ok: true, ecosystem });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
