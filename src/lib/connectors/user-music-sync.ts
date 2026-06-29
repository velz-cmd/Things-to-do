import { prisma } from "@/lib/db";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { navidromeScrobbleToSettlementEvents } from "@/lib/connectors/navidrome";
import { recordNavidromeBridgeCursor } from "@/lib/connectors/navidrome-sync";
import { fetchListenBrainzListens } from "@/lib/integrations/listenbrainz";
import { getNavidromeNowPlayingForUser } from "@/lib/integrations/navidrome-client";
import {
  userListenBrainzConfigured,
  userNavidromeConfigured,
} from "@/lib/profile/user-connections";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";

const LB_CURSOR_PREFIX = "listenbrainz.user.cursor.";
const ND_CURSOR_PREFIX = "navidrome.user.nowplaying.";

type MusicProgramContext = {
  missionId: string;
  perPlayUsd: number;
  founderUserId: string;
  communitySlug: string;
};

type SyncCursor = { lastListenedAt: string };
type NowPlayingCursor = { seenKeys: string[] };

async function getAppJson<T>(key: string): Promise<T | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function setAppJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });
}

async function resolveMusicProgram(userId: string): Promise<MusicProgramContext | null> {
  const program = await prisma.resolveProgram.findFirst({
    where: {
      userId,
      missionId: { not: null },
      install: { communitySlug: { in: ["independent-music", "navidrome"] } },
    },
    orderBy: { updatedAt: "desc" },
    include: { install: { select: { communitySlug: true } } },
  });

  if (!program?.missionId) return null;

  let perPlayUsd = Number(process.env.NAVIDROME_PER_PLAY_USD ?? "0.0004");
  try {
    const rules = JSON.parse(program.rulesJson) as { perPlayUsd?: number };
    if (rules.perPlayUsd) perPlayUsd = rules.perPlayUsd;
  } catch {
    /* ignore */
  }

  return {
    missionId: program.missionId,
    perPlayUsd,
    founderUserId: program.userId,
    communitySlug: program.install?.communitySlug ?? "independent-music",
  };
}

async function afterIngest(
  ctx: MusicProgramContext,
  ingested: number,
  totalUsd: number,
  source: string,
) {
  if (ingested > 0) {
    await recordTimelineEvent({
      userId: ctx.founderUserId,
      missionId: ctx.missionId,
      eventType: "music_sync",
      title: `${ingested} plays recognized`,
      detail: `$${totalUsd.toFixed(4)} authorized · ${source}`,
      severity: "info",
    }).catch(() => undefined);

    await recordNavidromeBridgeCursor("cloud", {
      submissionTime: new Date().toISOString(),
      id: `cloud-${Date.now()}`,
    }).catch(() => undefined);
  }
}

/** Pull ListenBrainz listens for one user — fully server-side, no local bridge. */
export async function syncUserListenBrainz(userId: string, options?: { max?: number }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { listenbrainzUsername: true, listenbrainzToken: true },
  });
  if (!user || !userListenBrainzConfigured(user)) {
    return { ok: false as const, reason: "listenbrainz_not_connected", ingested: 0, scanned: 0 };
  }

  const program = await resolveMusicProgram(userId);
  const max = options?.max ?? 50;
  const cursorKey = `${LB_CURSOR_PREFIX}${userId}`;
  const cursor = await getAppJson<SyncCursor>(cursorKey);

  const listens = await fetchListenBrainzListens(max, {
    username: user.listenbrainzUsername!,
    token: user.listenbrainzToken,
  });

  const newListens = cursor
    ? listens.filter((l) => l.listenedAt > cursor.lastListenedAt)
    : listens.slice(0, max);

  const events = [];
  for (const listen of newListens) {
    const rowEvents = await navidromeScrobbleToSettlementEvents({
      mediaFileId:
        listen.recordingMbid ?? listen.trackMbid ?? `${listen.artistName}-${listen.trackTitle}`,
      userId: user.listenbrainzUsername!,
      submissionTime: listen.listenedAt,
      artistName: listen.artistName,
      trackTitle: listen.trackTitle,
      recordingMbid: listen.recordingMbid,
      durationSec: 45,
      instanceId: "listenbrainz",
      perPlayUsd: program?.perPlayUsd,
      missionId: program?.missionId,
      listenBrainzUser: user.listenbrainzUsername!,
    });
    events.push(...rowEvents);
  }

  let ingested = 0;
  let totalUsd = 0;
  if (events.length) {
    const batch = await ingestSettlementBatch(events, {
      founderUserId: program?.founderUserId,
    });
    ingested = batch.count;
    totalUsd = batch.totalUsd;
    if (program) await afterIngest(program, ingested, totalUsd, "ListenBrainz");
  }

  if (listens[0]) {
    await setAppJson(cursorKey, { lastListenedAt: listens[0].listenedAt });
  }

  return {
    ok: true as const,
    source: "listenbrainz" as const,
    scanned: listens.length,
    newListens: newListens.length,
    ingested,
    lastListenAt: listens[0]?.listenedAt ?? cursor?.lastListenedAt ?? null,
  };
}

/** Poll Navidrome now-playing for one user when their library is reachable from the cloud. */
export async function syncUserNavidromeNowPlaying(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { navidromeUrl: true, navidromeUsername: true, navidromePassword: true },
  });
  if (!user || !userNavidromeConfigured(user)) {
    return { ok: false as const, reason: "navidrome_not_connected", ingested: 0, scanned: 0 };
  }

  const creds = {
    url: user.navidromeUrl!,
    username: user.navidromeUsername!,
    password: user.navidromePassword!,
  };

  const program = await resolveMusicProgram(userId);
  const cursorKey = `${ND_CURSOR_PREFIX}${userId}`;
  const cursor = (await getAppJson<NowPlayingCursor>(cursorKey)) ?? { seenKeys: [] };
  const seen = new Set(cursor.seenKeys);

  const playing = await getNavidromeNowPlayingForUser(creds);
  const fresh = playing.filter((p) => {
    const key = `${p.id}:${p.username}`;
    return !seen.has(key);
  });

  const events = [];
  const now = new Date().toISOString();
  for (const play of fresh) {
    const rowEvents = await navidromeScrobbleToSettlementEvents({
      mediaFileId: play.id,
      userId: play.username,
      submissionTime: now,
      artistName: play.artist,
      trackTitle: play.title,
      durationSec: play.durationSec || 45,
      instanceId: "navidrome-cloud",
      perPlayUsd: program?.perPlayUsd,
      missionId: program?.missionId,
    });
    events.push(...rowEvents);
    seen.add(`${play.id}:${play.username}`);
  }

  // Keep cursor bounded
  const seenKeys = [...seen].slice(-500);
  await setAppJson(cursorKey, { seenKeys });

  let ingested = 0;
  let totalUsd = 0;
  if (events.length) {
    const batch = await ingestSettlementBatch(events, {
      founderUserId: program?.founderUserId,
    });
    ingested = batch.count;
    totalUsd = batch.totalUsd;
    if (program) await afterIngest(program, ingested, totalUsd, "Navidrome");
  }

  return {
    ok: true as const,
    source: "navidrome" as const,
    scanned: playing.length,
    newPlays: fresh.length,
    ingested,
  };
}

export async function syncUserMusicSensors(userId: string) {
  const [lb, nd] = await Promise.all([
    syncUserListenBrainz(userId).catch((e) => ({
      ok: false as const,
      reason: e instanceof Error ? e.message : "listenbrainz_sync_failed",
      ingested: 0,
      scanned: 0,
    })),
    syncUserNavidromeNowPlaying(userId).catch((e) => ({
      ok: false as const,
      reason: e instanceof Error ? e.message : "navidrome_sync_failed",
      ingested: 0,
      scanned: 0,
    })),
  ]);

  return {
    ok: true as const,
    listenBrainz: lb,
    navidrome: nd,
    ingested: (lb.ingested ?? 0) + (nd.ingested ?? 0),
  };
}

/** Cron — sync every user who connected ListenBrainz or Navidrome on Profile. */
export async function syncAllUsersMusicSensors(limit = 40) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { listenbrainzUsername: { not: null } },
        {
          navidromeUrl: { not: null },
          navidromeUsername: { not: null },
          navidromePassword: { not: null },
        },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const results = [];
  for (const u of users) {
    results.push({ userId: u.id, ...(await syncUserMusicSensors(u.id)) });
  }

  return {
    ok: true as const,
    users: users.length,
    totalIngested: results.reduce((s, r) => s + r.ingested, 0),
    results,
  };
}

export async function getUserMusicSensorStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      listenbrainzUsername: true,
      navidromeUrl: true,
      navidromeUsername: true,
      navidromePassword: true,
    },
  });

  const lbCursor = await getAppJson<SyncCursor>(`${LB_CURSOR_PREFIX}${userId}`);
  const global = await getNavidromeSyncStatus().catch(() => null);

  const listenBrainzConnected = user ? userListenBrainzConfigured(user) : false;
  const navidromeConnected = user ? userNavidromeConfigured(user) : false;
  const lastSyncAt = lbCursor?.lastListenedAt ?? global?.cursor?.lastSubmissionTime ?? null;
  const receiving = Boolean(lastSyncAt);

  return {
    listenBrainzConnected,
    navidromeConnected,
    receiving,
    lastSyncAt,
    mode: "cloud" as const,
  };
}
