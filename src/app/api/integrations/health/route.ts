import { NextResponse } from "next/server";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";

/** Live ping of all external APIs — no secret values returned. */
export async function GET() {
  const health = await runIntegrationHealthCheck();
  const allCore =
    health.live.github.ok &&
    health.live.openRouter.ok &&
    health.live.librariesIo.ok;

  return NextResponse.json({
    ok: allCore,
    ...health,
  });
}
