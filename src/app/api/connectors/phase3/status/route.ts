import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";
import { PHASE3_TRACKS, type Phase3TrackId } from "@/lib/connectors/phase3-tracks";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import {
  userListenBrainzConfigured,
  userNavidromeConfigured,
  userJellyfinConfigured,
} from "@/lib/profile/user-connections";

export const dynamic = "force-dynamic";

async function trackConnectorReady(
  userId: string,
  trackId: Phase3TrackId,
  profile: {
    githubUsername: string | null;
    listenbrainzUsername: string | null;
    navidromeUrl: string | null;
    navidromeUsername: string | null;
    navidromePassword: string | null;
    jellyfinUrl: string | null;
    jellyfinAccessToken: string | null;
  },
): Promise<boolean> {
  if (trackId === "music") {
    return (
      userListenBrainzConfigured(profile) || userNavidromeConfigured(profile)
    );
  }
  if (trackId === "oss") {
    return Boolean(profile.githubUsername?.trim());
  }
  if (trackId === "media") {
    return userJellyfinConfigured(profile);
  }
  return true;
}

/** Phase 3 connector depth — music / OSS / research track status for signed-in user. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      githubUsername: true,
      listenbrainzUsername: true,
      navidromeUrl: true,
      navidromeUsername: true,
      navidromePassword: true,
      jellyfinUrl: true,
      jellyfinAccessToken: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  const installs = await prisma.resolveCommunityInstall.findMany({
    where: { userId: session.user.id },
    include: { programs: { where: { status: { in: ["active", "deployed"] } } } },
  });

  const tracks = await Promise.all(
    PHASE3_TRACKS.map(async (track) => {
      const trackInstalls = installs.filter((i) =>
        track.communitySlugs.includes(i.communitySlug),
      );
      const programs = trackInstalls.flatMap((i) => i.programs);
      const connectorReady = await trackConnectorReady(session.user.id, track.id, profile);

      const summaries = await Promise.all(
        programs
          .filter((p) => p.missionId)
          .map(async (p) => {
            const rules = JSON.parse(p.rulesJson) as { connectorId?: string; eventType?: string };
            const summary = await getAuthorizationSummary({
              missionId: p.missionId!,
              connectorId: rules.connectorId,
            });
            return {
              templateId: p.templateId,
              name: p.name,
              missionId: p.missionId,
              eventType: rules.eventType ?? track.event,
              authorizationCount: summary.count,
              authorizedUsd: summary.authorizedUsd + summary.pendingFundingUsd,
              claimableUsd: summary.claimableUsd,
            };
          }),
      );

      const authorizationCount = summaries.reduce((s, x) => s + x.authorizationCount, 0);
      const authorizedUsd = summaries.reduce((s, x) => s + x.authorizedUsd, 0);

      return {
        id: track.id,
        name: track.name,
        event: track.event,
        connector: track.connector,
        programTemplate: track.programTemplate,
        description: track.description,
        connectorReady,
        installed: trackInstalls.length > 0,
        communitySlugs: trackInstalls.map((i) => i.communitySlug),
        programs: summaries,
        authorizationCount,
        authorizedUsd,
        live: connectorReady && trackInstalls.length > 0,
        syncUrl: "/api/connectors/sensors/sync",
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    phase: 3,
    tracks,
    syncUrl: "/api/connectors/sensors/sync",
  });
}
