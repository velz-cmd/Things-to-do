import { prisma } from "@/lib/db";
import {
  authenticateJellyfin,
  getJellyfinNowPlaying,
  jellyfinTicksToSeconds,
} from "@/lib/integrations/jellyfin-client";
import { videoWatchToSettlementEvents } from "@/lib/connectors/video-pipeline";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { getActiveProgramMissionIds } from "@/lib/communities/programs";

export async function syncUserJellyfinSensors(userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      jellyfinUrl: true,
      jellyfinUsername: true,
      jellyfinAccessToken: true,
    },
  });

  if (!profile?.jellyfinUrl?.trim() || !profile.jellyfinAccessToken?.trim()) {
    return { ok: false as const, reason: "jellyfin_not_connected", ingested: 0 };
  }

  const programs = await getActiveProgramMissionIds(userId);
  const videoProgram = programs.find((p) => p.communitySlug === "jellyfin");
  const missionId = videoProgram?.missionId;
  const perWatchUsd = 0.001;

  const playing = await getJellyfinNowPlaying({
    url: profile.jellyfinUrl,
    accessToken: profile.jellyfinAccessToken,
  });

  const events = [];
  const now = new Date().toISOString();

  for (const row of playing) {
    const durationSec = jellyfinTicksToSeconds(row.positionTicks);
    const batch = await videoWatchToSettlementEvents({
      itemId: row.itemId,
      userId,
      watchedAt: now,
      title: row.title,
      mediaType: row.type,
      creatorName: row.seriesName ?? row.title,
      durationSec,
      instanceId: profile.jellyfinUsername ?? userId,
      perWatchUsd,
      missionId,
    });
    events.push(...batch);
  }

  if (!events.length) {
    return { ok: true as const, ingested: 0, watches: 0 };
  }

  const result = await ingestSettlementBatch(events);
  return {
    ok: true as const,
    ingested: result.count,
    watches: playing.length,
  };
}

export async function connectJellyfinForUser(
  userId: string,
  input: { url: string; username: string; password: string },
) {
  const auth = await authenticateJellyfin(input);
  if (!auth.ok || !auth.accessToken) {
    return { ok: false as const, error: auth.message };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      jellyfinUrl: input.url.trim().replace(/\/$/, ""),
      jellyfinUsername: input.username.trim(),
      jellyfinAccessToken: auth.accessToken,
    },
  });

  return { ok: true as const, message: auth.message };
}
