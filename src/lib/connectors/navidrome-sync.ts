import { prisma } from "@/lib/db";
import { navidromeScrobbleToSettlementInput } from "@/lib/connectors/navidrome";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";

export const NAVIDROME_SYNC_CURSOR_KEY = "navidrome.sync.cursor";

export type NavidromeSyncCursor = {
  lastSubmissionTime: string;
  lastId: string;
  instanceId: string;
};

export type NavidromeScrobbleRow = {
  id: string;
  userId: string;
  mediaFileId: string;
  submissionTime: string;
  artistName?: string;
  durationSec?: number;
};

async function getCursor(instanceId: string): Promise<NavidromeSyncCursor | null> {
  const row = await prisma.appConfig.findUnique({
    where: { key: NAVIDROME_SYNC_CURSOR_KEY },
  });
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as NavidromeSyncCursor;
    if (parsed.instanceId !== instanceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function setCursor(cursor: NavidromeSyncCursor) {
  await prisma.appConfig.upsert({
    where: { key: NAVIDROME_SYNC_CURSOR_KEY },
    create: { key: NAVIDROME_SYNC_CURSOR_KEY, value: JSON.stringify(cursor) },
    update: { value: JSON.stringify(cursor) },
  });
}

type SqliteDb = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => NavidromeScrobbleRow[];
  };
  close: () => void;
};

async function openNavidromeDb(dbPath: string): Promise<SqliteDb | null> {
  try {
    const mod = await import("better-sqlite3");
    const Database = mod.default;
    return new Database(dbPath, { readonly: true, fileMustExist: true }) as SqliteDb;
  } catch (e) {
    console.warn("[navidrome-sync] SQLite unavailable:", e);
    return null;
  }
}

function queryScrobbles(db: SqliteDb, cursor: NavidromeSyncCursor | null, limit: number) {
  if (cursor) {
    return db
      .prepare(
        `SELECT s.id, s.user_id as userId, s.media_file_id as mediaFileId,
                s.submission_time as submissionTime,
                COALESCE(a.name, '') as artistName,
                COALESCE(m.duration, 0) as durationSec
         FROM scrobble s
         LEFT JOIN media_file m ON m.id = s.media_file_id
         LEFT JOIN artist a ON a.id = m.artist_id
         WHERE s.submission_time > ? OR (s.submission_time = ? AND s.id > ?)
         ORDER BY s.submission_time ASC, s.id ASC
         LIMIT ?`,
      )
      .all(cursor.lastSubmissionTime, cursor.lastSubmissionTime, cursor.lastId, limit);
  }

  return db
    .prepare(
      `SELECT s.id, s.user_id as userId, s.media_file_id as mediaFileId,
              s.submission_time as submissionTime,
              COALESCE(a.name, '') as artistName,
              COALESCE(m.duration, 0) as durationSec
       FROM scrobble s
       LEFT JOIN media_file m ON m.id = s.media_file_id
       LEFT JOIN artist a ON a.id = m.artist_id
       ORDER BY s.submission_time ASC, s.id ASC
       LIMIT ?`,
    )
    .all(limit);
}

export async function ingestNavidromeScrobbles(
  rows: NavidromeScrobbleRow[],
  options?: { instanceId?: string; perPlayUsd?: number },
) {
  const instanceId = options?.instanceId ?? process.env.NAVIDROME_INSTANCE_ID ?? "default";
  const events = [];

  for (const row of rows) {
    const event = navidromeScrobbleToSettlementInput({
      mediaFileId: row.mediaFileId,
      userId: row.userId,
      submissionTime: row.submissionTime,
      artistName: row.artistName || undefined,
      durationSec: row.durationSec,
      instanceId,
      perPlayUsd: options?.perPlayUsd,
    });
    if (event) events.push(event);
  }

  if (!events.length) {
    return { ingested: 0, skipped: rows.length, events: [] as const };
  }

  const batch = await ingestSettlementBatch(events);
  return {
    ingested: batch.count,
    skipped: rows.length - batch.count,
    events: batch.authorizations,
  };
}

/** Tail Navidrome SQLite scrobble table when NAVIDROME_DB_PATH is set. */
export async function syncNavidromeFromSqlite(options?: {
  dbPath?: string;
  instanceId?: string;
  limit?: number;
  perPlayUsd?: number;
}) {
  const dbPath = options?.dbPath ?? process.env.NAVIDROME_DB_PATH?.trim();
  const instanceId = options?.instanceId ?? process.env.NAVIDROME_INSTANCE_ID ?? "default";

  if (!dbPath) {
    return {
      ok: false as const,
      mode: "sqlite" as const,
      reason: "NAVIDROME_DB_PATH not configured",
      ingested: 0,
      scanned: 0,
    };
  }

  const db = await openNavidromeDb(dbPath);
  if (!db) {
    return {
      ok: false as const,
      mode: "sqlite" as const,
      reason: "better-sqlite3 unavailable or database missing",
      ingested: 0,
      scanned: 0,
    };
  }

  try {
    const cursor = await getCursor(instanceId);
    const limit = options?.limit ?? 500;
    const rows = queryScrobbles(db, cursor, limit);
    const result = await ingestNavidromeScrobbles(rows, {
      instanceId,
      perPlayUsd: options?.perPlayUsd,
    });

    if (rows.length > 0) {
      const last = rows[rows.length - 1]!;
      await setCursor({
        instanceId,
        lastSubmissionTime: last.submissionTime,
        lastId: last.id,
      });
    }

    return {
      ok: true as const,
      mode: "sqlite" as const,
      scanned: rows.length,
      ingested: result.ingested,
      skipped: result.skipped,
      cursor: rows.length
        ? { lastSubmissionTime: rows[rows.length - 1]!.submissionTime, lastId: rows[rows.length - 1]!.id }
        : cursor,
    };
  } finally {
    db.close();
  }
}

export async function getNavidromeSyncStatus() {
  const row = await prisma.appConfig.findUnique({
    where: { key: NAVIDROME_SYNC_CURSOR_KEY },
  });
  let cursor: NavidromeSyncCursor | null = null;
  if (row?.value) {
    try {
      cursor = JSON.parse(row.value) as NavidromeSyncCursor;
    } catch {
      cursor = null;
    }
  }

  return {
    dbPathConfigured: Boolean(process.env.NAVIDROME_DB_PATH?.trim()),
    instanceId: process.env.NAVIDROME_INSTANCE_ID ?? "default",
    cursor,
    perPlayUsd: Number(process.env.NAVIDROME_PER_PLAY_USD ?? "0.0004"),
  };
}
