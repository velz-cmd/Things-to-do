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

function jellyfinIsConnected(profile: {
  jellyfinUrl: string | null;
  jellyfinUsername: string | null;
  jellyfinAccessToken: string | null;
  jellyfinPassword: string | null;
}) {
  return Boolean(
    profile.jellyfinUrl?.trim() &&
      profile.jellyfinUsername?.trim() &&
      (profile.jellyfinAccessToken?.trim() || profile.jellyfinPassword?.trim()),
  );
}

/** Cloud sync — public Jellyfin URLs only. Local servers sync via the user's browser. */
export async function syncUserJellyfinSensors(userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      jellyfinUrl: true,
      jellyfinUsername: true,
      jellyfinAccessToken: true,
      jellyfinPassword: true,
    },
  });

  if (!profile || !jellyfinIsConnected(profile)) {
    return { ok: false as const, reason: "jellyfin_not_connected", ingested: 0 };
  }

  if (isPrivateJellyfinUrl(profile.jellyfinUrl!) || !profile.jellyfinAccessToken?.trim()) {
    return {
      ok: true as const,
      ingested: 0,
      watches: 0,
      reason: "browser_sync" as const,
    };
  }

  const playing = await getJellyfinNowPlaying({
    url: profile.jellyfinUrl!,
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
  input: {
    url: string;
    username: string;
    accessToken?: string;
    password?: string;
  },
) {
  const url = input.url.trim().replace(/\/$/, "");
  const username = input.username.trim();
  const accessToken = input.accessToken?.trim() ?? "";
  const password = input.password?.trim() ?? "";

  if (!url || !username || (!accessToken && !password)) {
    return {
      ok: false as const,
      error: "Server URL, username, and Jellyfin account password are required",
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      jellyfinUrl: url,
      jellyfinUsername: username,
      jellyfinAccessToken: accessToken || null,
      jellyfinPassword: password || null,
    },
  });

  return {
    ok: true as const,
    message: "Jellyfin connected — community installed, watches sync automatically",
    accessToken: accessToken || undefined,
  };
}

/** Connect with Jellyfin account password — same pattern as Navidrome credentials. */
export async function connectJellyfinForUser(
  userId: string,
  input: { url: string; username: string; password: string; accessToken?: string },
) {
  const url = input.url.trim().replace(/\/$/, "");
  const username = input.username.trim();
  const password = input.password.trim();

  if (input.accessToken?.trim()) {
    return saveJellyfinConnection(userId, {
      url,
      username,
      accessToken: input.accessToken,
      password,
    });
  }

  if (!isPrivateJellyfinUrl(url)) {
    const auth = await authenticateJellyfin({ url, username, password });
    if (auth.ok && auth.accessToken) {
      return saveJellyfinConnection(userId, {
        url,
        username,
        accessToken: auth.accessToken,
        password,
      });
    }
    if (auth.message && !auth.message.includes("could not reach")) {
      return { ok: false as const, error: auth.message };
    }
  }

  return saveJellyfinConnection(userId, { url, username, password });
}
