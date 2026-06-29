import { prisma } from "@/lib/db";
import {
  authenticateJellyfin,
  getJellyfinNowPlaying,
  jellyfinTicksToSeconds,
  normalizeJellyfinApiKey,
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
      reason: "local_bridge_required" as const,
    };
  }

  const { missionId, perWatchUsd } = await jellyfinMissionForUser(userId);

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

export async function connectJellyfinForUser(
  userId: string,
  input: { url: string; username: string; password: string },
) {
  const url = input.url.trim().replace(/\/$/, "");
  const username = input.username.trim();
  const secret = input.password.trim();

  if (!url || !username || !secret) {
    return { ok: false as const, error: "Server URL, username, and password or API key are required" };
  }

  if (isPrivateJellyfinUrl(url)) {
    const accessToken = normalizeJellyfinApiKey(secret);
    if (accessToken.length < 8) {
      return {
        ok: false as const,
        error:
          "For local Jellyfin servers, create an API key in Dashboard → Advanced → API Keys and paste it in the password field.",
      };
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
      message:
        "Jellyfin saved (local server). Community installed — run scripts/jellyfin-bridge.ts on your PC to sync watches.",
      localMode: true as const,
    };
  }

  const auth = await authenticateJellyfin({ url, username, password: secret });
  if (!auth.ok || !auth.accessToken) {
    return { ok: false as const, error: auth.message };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      jellyfinUrl: url,
      jellyfinUsername: username,
      jellyfinAccessToken: auth.accessToken,
    },
  });

  return { ok: true as const, message: auth.message, localMode: false as const };
}
