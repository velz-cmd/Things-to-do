/**
 * Jellyfin bridge — run on the same PC as Jellyfin (not Vercel).
 *
 * Usage:
 *   JELLYFIN_URL=http://localhost:8096 \
 *   JELLYFIN_API_KEY=your-api-key-from-dashboard \
 *   RESOLVE_USER_ID=your-supabase-user-id \
 *   RESOLVE_SYNC_URL=https://resolve-task.vercel.app/api/connectors/jellyfin/sync \
 *   JELLYFIN_SYNC_SECRET=your-cron-secret \
 *   npx tsx scripts/jellyfin-bridge.ts
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

type Cursor = Record<string, string>;

const jellyfinUrl = process.env.JELLYFIN_URL?.trim()?.replace(/\/$/, "");
const apiKey = process.env.JELLYFIN_API_KEY?.trim();
const userId = process.env.RESOLVE_USER_ID?.trim();
const syncUrl =
  process.env.RESOLVE_SYNC_URL?.trim() ||
  `${process.env.APP_URL?.replace(/\/$/, "")}/api/connectors/jellyfin/sync`;
const secret =
  process.env.JELLYFIN_SYNC_SECRET?.trim() || process.env.CRON_SECRET?.trim();
const cursorFile =
  process.env.JELLYFIN_BRIDGE_CURSOR_FILE ??
  join(process.cwd(), ".jellyfin-bridge-cursor.json");

if (!jellyfinUrl || !apiKey || !userId || !syncUrl) {
  console.error(
    "Required: JELLYFIN_URL, JELLYFIN_API_KEY, RESOLVE_USER_ID, RESOLVE_SYNC_URL (or APP_URL)",
  );
  process.exit(1);
}

function loadCursor(): Cursor {
  if (!existsSync(cursorFile)) return {};
  try {
    return JSON.parse(readFileSync(cursorFile, "utf8")) as Cursor;
  } catch {
    return {};
  }
}

function saveCursor(cursor: Cursor) {
  writeFileSync(cursorFile, JSON.stringify(cursor, null, 2));
}

function ticksToSeconds(ticks: number): number {
  return Math.floor(ticks / 10_000_000);
}

async function fetchNowPlaying() {
  const res = await fetch(
    `${jellyfinUrl}/Sessions?activeWithinSeconds=120&nowPlaying=true`,
    {
      headers: {
        Authorization: `MediaBrowser Token="${apiKey}"`,
        Accept: "application/json",
        "User-Agent": "RESOLVE-Jellyfin-Bridge/1.0",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Jellyfin sessions HTTP ${res.status}`);
  }
  return (await res.json()) as Array<{
    Id?: string;
    NowPlayingItem?: { Id?: string; Name?: string; Type?: string; SeriesName?: string };
    PlayState?: { PositionTicks?: number; IsPaused?: boolean };
  }>;
}

async function main() {
  const cursor = loadCursor();
  const sessions = await fetchNowPlaying();
  const watches = [];
  const now = new Date().toISOString();

  for (const s of sessions) {
    const item = s.NowPlayingItem;
    if (!item?.Id || !s.Id) continue;
    if (s.PlayState?.IsPaused) continue;

    const durationSec = ticksToSeconds(s.PlayState?.PositionTicks ?? 0);
    if (durationSec > 0 && durationSec < 60) continue;

    const key = `${item.Id}:${s.Id}`;
    if (cursor[key]) continue;

    watches.push({
      itemId: item.Id,
      watchedAt: now,
      title: item.Name ?? item.Id,
      mediaType: item.Type,
      creatorName: item.SeriesName ?? item.Name,
      durationSec,
    });
    cursor[key] = now;
  }

  if (!watches.length) {
    console.log("[jellyfin-bridge] no new watches");
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "RESOLVE-Jellyfin-Bridge/1.0",
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(syncUrl!, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, watches }),
  });
  const data = (await res.json()) as { error?: string; ingested?: number };

  if (!res.ok) {
    console.error("[jellyfin-bridge] sync failed:", data);
    process.exit(1);
  }

  saveCursor(cursor);
  console.log(
    `[jellyfin-bridge] pushed ${watches.length} watches → ingested ${data.ingested ?? 0}`,
  );
}

void main().catch((e) => {
  console.error("[jellyfin-bridge]", e instanceof Error ? e.message : e);
  process.exit(1);
});
