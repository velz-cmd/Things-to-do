import { NextResponse } from "next/server";
import { importBatchSchema, importDiscoverOpportunities } from "@/lib/discover/marketplace/import";
import { prisma } from "@/lib/db";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const runs = await prisma.discoverImportRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });
  const records = await prisma.discoverImportRecord.findMany({
    where: { runId: { in: runs.map((run) => run.id) } },
    orderBy: { importedAt: "desc" },
    take: 250,
    select: {
      runId: true,
      source: true,
      sourceRecordId: true,
      validationResult: true,
      rejectionReason: true,
      duplicateOpportunityId: true,
      normalizedOpportunityId: true,
      publishedStatus: true,
      importedAt: true,
    },
  });
  return NextResponse.json({ runs, records });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = importBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Import batch is invalid", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const report = await importDiscoverOpportunities(parsed.data);
  return NextResponse.json(report, { status: 201 });
}
