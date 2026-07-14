import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { syncOpenAlexCommunitySensors } from "@/lib/sensors/sync";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { getCronSecret } from "@/lib/env/cron-secret";
import { completeSourceSync, failSourceSync, startSourceSync } from "@/lib/sources/sync-lifecycle";

function authorizeCron(req: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  return req.headers.get("authorization")?.trim() === `Bearer ${secret}`;
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

  const communitySlug = parsed.data.communitySlug ?? "open-research";
  const lifecycle = founderUserId
    ? await startSourceSync({ userId: founderUserId, communitySlug, provider: "openalex", displayLabel: "OpenAlex" })
    : null;
  let result: Awaited<ReturnType<typeof syncOpenAlexCommunitySensors>>;
  try {
    result = await syncOpenAlexCommunitySensors({
      communitySlug,
      missionId: parsed.data.missionId,
      founderUserId,
    });
    if (lifecycle && founderUserId) {
      await completeSourceSync({ userId: founderUserId, connectionId: lifecycle.connection.id, syncRunId: lifecycle.run.id, communitySlug, provider: "openalex", evidenceCount: result.ingested ?? result.observations ?? 0, result });
    }
  } catch (error) {
    if (lifecycle && founderUserId) {
      await failSourceSync({ userId: founderUserId, connectionId: lifecycle.connection.id, syncRunId: lifecycle.run.id, communitySlug, provider: "openalex", error }).catch(() => null);
    }
    return NextResponse.json({ error: "OpenAlex synchronization failed; cached evidence remains available" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    pipeline: "sensor → observation → authorization",
    publicApi: true,
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
