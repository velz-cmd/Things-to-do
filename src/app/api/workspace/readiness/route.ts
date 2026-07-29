import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import {
  loadWorkspaceReadiness,
  refreshWorkspaceReadiness,
} from "@/lib/workspace/readiness";

export const dynamic = "force-dynamic";

const refreshSchema = z.object({
  resource: z.enum(["github", "repository", "wallet", "payout", "capital", "all"]),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  }
  try {
    const readiness = await loadWorkspaceReadiness(user.id);
    return NextResponse.json(
      { ok: true, readiness },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "workspace_readiness_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  }
  const parsed = refreshSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_refresh_resource" }, { status: 400 });
  }
  try {
    const readiness = await refreshWorkspaceReadiness(user.id);
    return NextResponse.json({ ok: true, resource: parsed.data.resource, readiness });
  } catch {
    return NextResponse.json(
      { ok: false, error: `${parsed.data.resource}_readiness_refresh_failed` },
      { status: 503 },
    );
  }
}
