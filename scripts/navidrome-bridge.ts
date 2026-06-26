/**
 * Navidrome bridge — run on the Navidrome host to push new scrobbles to RESOLVE.
 *
 * Usage:
 *   NAVIDROME_DB_PATH=/path/to/navidrome.db \
 *   RESOLVE_SYNC_URL=https://resolve-task.vercel.app/api/connectors/navidrome/sync \
 *   NAVIDROME_SYNC_SECRET=your-secret \
 *   npx tsx scripts/navidrome-bridge.ts
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

type Cursor = { lastSubmissionTime: string; lastId: string };

const dbPath = process.env.NAVIDROME_DB_PATH?.trim();
const syncUrl =
  process.env.RESOLVE_SYNC_URL?.trim() ||
  `${process.env.APP_URL?.replace(/\/$/, "")}/api/connectors/navidrome/sync`;
const secret = process.env.NAVIDROME_SYNC_SECRET?.trim() || process.env.CRON_SECRET?.trim();
const instanceId = process.env.NAVIDROME_INSTANCE_ID ?? "default";
const cursorFile =
  process.env.NAVIDROME_BRIDGE_CURSOR_FILE ??
  join(process.cwd(), ".navidrome-bridge-cursor.json");

if (!dbPath || !syncUrl) {
  console.error("NAVIDROME_DB_PATH and RESOLVE_SYNC_URL (or APP_URL) required");
  process.exit(1);
}

function loadCursor(): Cursor | null {
  if (!existsSync(cursorFile)) return null;
  try {
    return JSON.parse(readFileSync(cursorFile, "utf8")) as Cursor;
  } catch {
    return null;
  }
}

function saveCursor(cursor: Cursor) {
  writeFileSync(cursorFile, JSON.stringify(cursor, null, 2));
}

async function main() {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const cursor = loadCursor();
  const limit = Number(process.env.NAVIDROME_BRIDGE_BATCH ?? "200");

  const rows = cursor
    ? (db
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
        .all(cursor.lastSubmissionTime, cursor.lastSubmissionTime, cursor.lastId, limit) as {
        id: string;
        userId: string;
        mediaFileId: string;
        submissionTime: string;
        artistName: string;
        durationSec: number;
      }[])
    : (db
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
        .all(limit) as {
        id: string;
        userId: string;
        mediaFileId: string;
        submissionTime: string;
        artistName: string;
        durationSec: number;
      }[]);

  db.close();

  if (!rows.length) {
    console.log("[navidrome-bridge] no new scrobbles");
    return;
  }

  const res = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      instanceId,
      scrobbles: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        mediaFileId: r.mediaFileId,
        submissionTime: r.submissionTime,
        artistName: r.artistName || undefined,
        durationSec: r.durationSec,
      })),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[navidrome-bridge] sync failed:", data);
    process.exit(1);
  }

  const last = rows[rows.length - 1]!;
  saveCursor({ lastSubmissionTime: last.submissionTime, lastId: last.id });
  console.log(
    `[navidrome-bridge] pushed ${rows.length} scrobbles → ingested ${data.ingested ?? 0}`,
  );
}

void main();
