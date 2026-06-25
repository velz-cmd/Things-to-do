import { NextResponse } from "next/server";
import { AGENT_STATUS, getAgentLog } from "@/lib/discovery/agent";

/** Live discovery agent activity — Rug Jeez-style transparency. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(80, Number(searchParams.get("limit") ?? 40));

  const events = getAgentLog(limit);

  return NextResponse.json({
    agent: AGENT_STATUS,
    live: true,
    events,
    thesis: "Find who should be paid — before anyone uploads a CSV",
  });
}
