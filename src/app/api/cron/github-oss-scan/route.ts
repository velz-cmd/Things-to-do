import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { refreshOssOpportunityStore } from "@/lib/github/oss-scan-store";

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshOssOpportunityStore();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "oss_scan_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = GET;
