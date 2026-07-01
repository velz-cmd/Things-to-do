import { NextResponse } from "next/server";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";

export async function GET() {
  if (!isDeputyDemoMode()) {
    return NextResponse.json({
      outcomes: [],
      demoOnly: true,
      message: "Hackathon merchant templates are Mission-only when DEPUTY_DEMO_MODE is enabled",
      livePath: "/discover#agent-market",
    });
  }
  return NextResponse.json({ outcomes: DEMO_OUTCOMES, demoOnly: false });
}
