import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { syncOpenCollectiveCommunitySensors } from "@/lib/sensors/sync";
import { isOpenCollectiveConfigured } from "@/lib/integrations/opencollective";
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
  openCollectiveSlug: z.string().optional(),
});

/** Open Collective sensor sync — QF contributions + match allocation (RFB #6). */
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

  const communitySlug = parsed.data.communitySlug ?? "react";
  if (!getCommunityBySlug(communitySlug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const lifecycle = founderUserId
    ? await startSourceSync({ userId: founderUserId, communitySlug, provider: "opencollective", displayLabel: "Open Collective" })
    : null;
  let result: Awaited<ReturnType<typeof syncOpenCollectiveCommunitySensors>>;
  try {
    result = await syncOpenCollectiveCommunitySensors({
      communitySlug,
      missionId: parsed.data.missionId,
      founderUserId,
      openCollectiveSlug: parsed.data.openCollectiveSlug,
    });
    if (lifecycle && founderUserId) {
      await completeSourceSync({ userId: founderUserId, connectionId: lifecycle.connection.id, syncRunId: lifecycle.run.id, communitySlug, provider: "opencollective", evidenceCount: result.ingested ?? result.observations ?? 0, result });
    }
  } catch (error) {
    if (lifecycle && founderUserId) {
      await failSourceSync({ userId: founderUserId, connectionId: lifecycle.connection.id, syncRunId: lifecycle.run.id, communitySlug, provider: "opencollective", error }).catch(() => null);
    }
    return NextResponse.json({ error: "Open Collective synchronization failed; the last confirmed snapshot is unchanged" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    pipeline: "opencollective → qf.contribution → qf.match → authorization",
    program: "quadratic-funding (RFB #6)",
    tokenConfigured: isOpenCollectiveConfigured(),
    ...result,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    connector: "opencollective",
    mode: "sensor",
    program: "quadratic-funding (RFB #6)",
    communities: ["react"],
    tokenConfigured: isOpenCollectiveConfigured(),
    syncEndpoint: "POST /api/connectors/opencollective/sync",
  });
}
