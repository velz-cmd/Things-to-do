import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { syncOpenCollectiveCommunitySensors } from "@/lib/sensors/sync";
import { isOpenCollectiveConfigured } from "@/lib/integrations/opencollective";
import { getCronSecret } from "@/lib/env/cron-secret";

function authorizeCron(req: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true;
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

  const result = await syncOpenCollectiveCommunitySensors({
    communitySlug,
    missionId: parsed.data.missionId,
    founderUserId,
    openCollectiveSlug: parsed.data.openCollectiveSlug,
  });

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
