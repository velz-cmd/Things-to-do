import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import {
  learnAndRebalanceProgram,
  measureProgramOutcomes,
} from "@/lib/communities/measure-learn";
import { buildCommunitySurface } from "@/lib/communities/surface";

type Params = { params: Promise<{ slug: string; programId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { programId } = await params;
  const report = await measureProgramOutcomes(ready.user.id, programId);
  if (!report) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}

export async function POST(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { slug, programId } = await params;
  const result = await learnAndRebalanceProgram(ready.user.id, programId);

  if ("ok" in result && result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const report = result as import("@/lib/communities/measure-learn").MeasureLearnReport;
  const community = await buildCommunitySurface(ready.user.id, slug);

  return NextResponse.json({
    ok: true,
    report,
    community,
    message: report.applied
      ? `Rebalanced — ${JSON.stringify(report.appliedChange)}`
      : "Measured — no automatic adjustment recommended yet",
  });
}
