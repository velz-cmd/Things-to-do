import { NextResponse } from "next/server";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { authorizeCronRequest } from "@/lib/env/cron-secret";

/** Operator health panel — live pings all external APIs. Not used on user tab loads. */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === "production" && !authorizeCronRequest(req)) {
    return NextResponse.json(
      { error: "Operator auth required — use Authorization: Bearer CRON_SECRET" },
      { status: 401 },
    );
  }

  const health = await runIntegrationHealthCheck();

  const coreLive =
    health.live.github.ok &&
    (health.live.groq.ok || health.live.gemini.ok || health.live.openRouter.ok);

  const searchLive = health.live.tavily.ok || health.live.serper.ok;

  return NextResponse.json({
    ok: coreLive,
    coreLive,
    searchLive,
    aiLive: health.live.groq.ok || health.live.gemini.ok || health.live.openRouter.ok,
    ...health,
  });
}
