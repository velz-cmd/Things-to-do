import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { processDistribution } from "@/lib/treasury/distribute";
import type { DistributeRequest } from "@/lib/gateway/types";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = (await req.json()) as DistributeRequest;
  if (!body.events?.length) {
    return NextResponse.json({ error: "No events provided" }, { status: 400 });
  }

  const result = await processDistribution(body, ready.user.id);
  return NextResponse.json(result);
}
