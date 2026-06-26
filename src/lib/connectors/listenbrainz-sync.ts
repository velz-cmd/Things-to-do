import { prisma } from "@/lib/db";
import { fetchListenBrainzListens } from "@/lib/integrations/listenbrainz";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { navidromeScrobbleToSettlementEvents } from "@/lib/connectors/navidrome";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { env } from "@/lib/integrations/config";

export const LISTENBRAINZ_SYNC_CURSOR_KEY = "listenbrainz.sync.cursor";

type SyncCursor = { lastListenedAt: string };

async function getCursor(): Promise<SyncCursor | null> {
  const row = await prisma.appConfig.findUnique({
    where: { key: LISTENBRAINZ_SYNC_CURSOR_KEY },
  });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as SyncCursor;
  } catch {
    return null;
  }
}

async function setCursor(cursor: SyncCursor) {
  await prisma.appConfig.upsert({
    where: { key: LISTENBRAINZ_SYNC_CURSOR_KEY },
    create: { key: LISTENBRAINZ_SYNC_CURSOR_KEY, value: JSON.stringify(cursor) },
    update: { value: JSON.stringify(cursor) },
  });
}

/**
 * Ingest listens from ListenBrainz — primary Vercel path when Navidrome scrobbles
 * are forwarded to ListenBrainz (no SQLite bridge required).
 */
export async function syncListenBrainzListens(options?: { max?: number }) {
  if (!isListenBrainzConfigured()) {
    return {
      ok: false as const,
      reason: "LISTENBRAINZ_USERNAME not set",
      ingested: 0,
      scanned: 0,
    };
  }

  const user = env("LISTENBRAINZ_USERNAME")!;
  const instanceId = env("NAVIDROME_INSTANCE_ID") ?? "listenbrainz";
  const perPlayUsd = Number(env("NAVIDROME_PER_PLAY_USD") ?? "0.0004");
  const cursor = await getCursor();
  const max = options?.max ?? 50;

  const listens = await fetchListenBrainzListens(max);
  const newListens = cursor
    ? listens.filter((l) => l.listenedAt > cursor.lastListenedAt)
    : listens;

  const events = [];
  for (const listen of newListens) {
    const rowEvents = await navidromeScrobbleToSettlementEvents({
      mediaFileId: listen.recordingMbid ?? listen.trackMbid ?? `${listen.artistName}-${listen.trackTitle}`,
      userId: user,
      submissionTime: listen.listenedAt,
      artistName: listen.artistName,
      trackTitle: listen.trackTitle,
      recordingMbid: listen.recordingMbid,
      durationSec: 45,
      instanceId,
      perPlayUsd,
      listenBrainzUser: user,
    });
    events.push(...rowEvents);
  }

  let ingested = 0;
  if (events.length) {
    const batch = await ingestSettlementBatch(events);
    ingested = batch.count;
  }

  if (listens[0]) {
    await setCursor({ lastListenedAt: listens[0].listenedAt });
  }

  return {
    ok: true as const,
    scanned: listens.length,
    newListens: newListens.length,
    ingested,
    cursor: listens[0]?.listenedAt ?? cursor?.lastListenedAt ?? null,
  };
}

export async function getListenBrainzSyncStatus() {
  const cursor = await getCursor();
  return {
    configured: isListenBrainzConfigured(),
    cursor,
    syncEndpoint: "/api/connectors/listenbrainz/sync",
  };
}
