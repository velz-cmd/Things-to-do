import { NextResponse } from "next/server";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";

/** Live ping of all external APIs — no secret values returned. */
export async function GET() {
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
