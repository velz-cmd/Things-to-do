import { NextResponse } from "next/server";
import { importDiscoverOpportunities } from "@/lib/discover/marketplace/import";
import { prisma } from "@/lib/db";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const source = typeof body.source === "string" ? body.source : null;
  const failed = await prisma.discoverImportRecord.findMany({
    where: {
      validationResult: "rejected",
      ...(source ? { source } : {}),
    },
    orderBy: { importedAt: "desc" },
    take: 250,
    select: { source: true, inputPayload: true },
  });
  if (!failed.length) {
    return NextResponse.json({ ok: true, reprocessed: 0 });
  }
  const bySource = new Map<string, unknown[]>();
  for (const record of failed) {
    bySource.set(record.source, [...(bySource.get(record.source) ?? []), record.inputPayload]);
  }
  const reports = [];
  for (const [failedSource, records] of bySource) {
    const parsedSource = failedSource as Parameters<typeof importDiscoverOpportunities>[0]["source"];
    reports.push(
      await importDiscoverOpportunities({
        source: parsedSource,
        records,
      }),
    );
  }
  return NextResponse.json({ ok: true, reprocessed: failed.length, reports });
}
