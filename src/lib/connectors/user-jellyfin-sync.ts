import { prisma } from "@/lib/db";
import {
  authenticateJellyfin,
  getJellyfinNowPlaying,
  jellyfinTicksToSeconds,
} from "@/lib/integrations/jellyfin-client";
import { isPrivateJellyfinUrl } from "@/lib/integrations/jellyfin-url";
import { videoWatchToSettlementEvents } from "@/lib/connectors/video-pipeline";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { getActiveProgramMissionIds } from "@/lib/communities/programs";

export type JellyfinWatchInput = {
  itemId: string;
  userId: string;
  watchedAt: string;
  title: string;
  mediaType?: string;
  creatorName?: string;
  durationSec?: number;
  instanceId?: string;
};

async function jellyfinMissionForUser(userId: string) {
  const programs = await getActiveProgramMissionIds(userId);
  const videoProgram = programs.find((p) => p.communitySlug === "jellyfin");
  return {
    missionId: videoProgram?.missionId,
    perWatchUsd: 0.001,
    instanceId: videoProgram?.communitySlug ?? "jellyfin",
  };
}

export async function ingestJellyfinWatches(
  userId: string,
  watches: JellyfinWatchInput[],
) {
  if (!watches.length) {
    return { ok: true as const, ingested: 0, watches: 0 };
  }

  const { missionId, perWatchUsd, instanceId } = await jellyfinMissionForUser(userId);
  const events = [];

  for (const row of watches) {
    const batch = await videoWatchToSettlementEvents({
      itemId: row.itemId,
      userId,
      watchedAt: row.watchedAt,
      title: row.title,
      mediaType: row.mediaType,
      creatorName: row.creatorName,
      durationSec: row.durationSec,
      instanceId: row.instanceId ?? instanceId,
      perWatchUsd,
      missionId,
    });
    events.push(...batch);
  }

  if (!events.length) {
    return { ok: true as const, ingested: 0, watches: watches.length };
  }

  const result = await ingestSettlementBatch(events);
  return {
    ok: true as const,
    ingested: result.count,
    watches: watches.length,
    missionId: result.missionId,
  };
}

/** Cloud sync — public Jellyfin URLs only. Local servers sync via the user's browser. */
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

  if (isPrivateJellyfinUrl(profile.jellyfinUrl)) {
    return {
      ok: true as const,
      ingested: 0,
      watches: 0,
      reason: "browser_sync" as const,
    };
  }

  const playing = await getJellyfinNowPlaying({
    url: profile.jellyfinUrl,
    accessToken: profile.jellyfinAccessToken,
  });

  const watches: JellyfinWatchInput[] = playing.map((row) => ({
    itemId: row.itemId,
    userId,
    watchedAt: new Date().toISOString(),
    title: row.title,
    mediaType: row.type,
    creatorName: row.seriesName ?? row.title,
    durationSec: jellyfinTicksToSeconds(row.positionTicks),
    instanceId: profile.jellyfinUsername ?? userId,
  }));

  const result = await ingestJellyfinWatches(userId, watches);
  return {
    ok: true as const,
    ingested: result.ingested,
    watches: result.watches,
  };
}

export async function saveJellyfinConnection(
  userId: string,
  input: { url: string; username: string; accessToken: string },
) {
  const url = input.url.trim().replace(/\/$/, "");
  const username = input.username.trim();
  const accessToken = input.accessToken.trim();

  if (!url || !username || !accessToken) {
    return { ok: false as const, error: "Server URL, username, and access token are required" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      jellyfinUrl: url,
      jellyfinUsername: username,
      jellyfinAccessToken: accessToken,
    },
  });

  return {
    ok: true as const,
    message: "Jellyfin connected — community installed, watches sync automatically",
    accessToken,
  };
}

/** Legacy server-side password connect (public URLs). Prefer browser token flow. */
export async function connectJellyfinForUser(
  userId: string,
  input: { url: string; username: string; password: string },
) {
  const auth = await authenticateJellyfin(input);
  if (!auth.ok || !auth.accessToken) {
    return { ok: false as const, error: auth.message };
  }

  return saveJellyfinConnection(userId, {
    url: input.url,
    username: input.username,
    accessToken: auth.accessToken,
  });
}
