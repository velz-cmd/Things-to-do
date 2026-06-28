import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { syncOpenAlexCommunitySensors } from "@/lib/sensors/sync";
import { INTEGRATIONS } from "@/lib/integrations/config";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const bodySchema = z.object({
  communitySlug: z.string().optional(),
  missionId: z.string().optional(),
});

/** OpenAlex sensor sync — citation toll authorizations (RFB #2). */
export async function POST(req: Request) {
  const cronOk = authorizeCron(req);
  let founderUserId: string | undefined;

  if (!cronOk) {
    const ready = await requireReadyUser();
    if ("error" in ready) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    founderUserId = ready.user.id;
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!INTEGRATIONS.openAlex()) {
    return NextResponse.json({
      ok: false,
      error: "OPENALEX_API_KEY required for citation sensor sync",
      live: false,
    }, { status: 503 });
  }

  const result = await syncOpenAlexCommunitySensors({
    communitySlug: parsed.data.communitySlug,
    missionId: parsed.data.missionId,
    founderUserId,
  });

  return NextResponse.json({
    ok: true,
    pipeline: "sensor → observation → authorization",
    ...result,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    connector: "openalex",
    mode: "sensor",
    program: "citation-toll (RFB #2)",
    community: "open-research",
    apiConfigured: INTEGRATIONS.openAlex(),
    syncEndpoint: "POST /api/connectors/openalex/sync",
  });
}
