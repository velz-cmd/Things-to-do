import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { syncGithubCommunitySensors } from "@/lib/sensors/sync";
import { hasGithubToken } from "@/lib/github/client";
import { COMMUNITY_GITHUB_TARGETS } from "@/lib/sensors/targets";

import { getCronSecret } from "@/lib/env/cron-secret";
import { completeSourceSync, failSourceSync, startSourceSync } from "@/lib/sources/sync-lifecycle";

function authorizeCron(req: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  return req.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

const bodySchema = z.object({
  communitySlug: z.enum(["react", "linux"]),
  missionId: z.string().optional(),
  includeSecurity: z.boolean().optional(),
});

/** GitHub sensor sync — docs merged PRs (RFB #3) + security advisories (RFB #4). */
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
    return NextResponse.json({ error: "Invalid body — communitySlug: react | linux" }, { status: 400 });
  }

  const { communitySlug, missionId, includeSecurity } = parsed.data;
  if (!getCommunityBySlug(communitySlug)) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const lifecycle = founderUserId
    ? await startSourceSync({ userId: founderUserId, communitySlug, provider: "github", displayLabel: "GitHub" })
    : null;
  let result: Awaited<ReturnType<typeof syncGithubCommunitySensors>>;
  try {
    result = await syncGithubCommunitySensors({
      communitySlug,
      missionId,
      founderUserId,
      includeSecurity,
    });
    if (lifecycle && founderUserId) {
      await completeSourceSync({
        userId: founderUserId,
        connectionId: lifecycle.connection.id,
        syncRunId: lifecycle.run.id,
        communitySlug,
        provider: "github",
        evidenceCount: result.ingested ?? result.observations ?? 0,
        result,
      });
    }
  } catch (error) {
    if (lifecycle && founderUserId) {
      await failSourceSync({ userId: founderUserId, connectionId: lifecycle.connection.id, syncRunId: lifecycle.run.id, communitySlug, provider: "github", error }).catch(() => null);
    }
    return NextResponse.json({ error: "GitHub synchronization failed; the last confirmed snapshot is still available" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    pipeline: "sensor → observation → authorization",
    publicApi: !hasGithubToken(),
    rateLimitNote: hasGithubToken()
      ? "Platform token active — higher GitHub rate limits"
      : "Using public GitHub API — works globally for any user",
    ...result,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    connector: "github",
    mode: "sensor",
    programs: ["docs-bounty (RFB #3)", "security-fund (RFB #4)"],
    communities: Object.keys(COMMUNITY_GITHUB_TARGETS),
    tokenConfigured: hasGithubToken(),
    syncEndpoint: "POST /api/connectors/github/sync",
  });
}
