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

/**
 * Vercel cannot read a local Navidrome SQLite file — use scripts/navidrome-bridge.ts
 * on the Navidrome host to POST batches to /api/connectors/navidrome/sync.
 */
export async function syncNavidromeFromSqlite(_options?: {
  dbPath?: string;
  instanceId?: string;
  limit?: number;
  perPlayUsd?: number;
}) {
  return {
    ok: false as const,
    mode: "bridge" as const,
    reason:
      "SQLite sync runs on the Navidrome host via scripts/navidrome-bridge.ts (not on Vercel). POST scrobble batches to /api/connectors/navidrome/sync instead.",
    ingested: 0,
    scanned: 0,
  };
}

/** Update remote cursor after a successful bridge batch push. */
export async function recordNavidromeBridgeCursor(
  instanceId: string,
  lastRow: { submissionTime: string; id: string },
) {
  await setCursor({
    instanceId,
    lastSubmissionTime: lastRow.submissionTime,
    lastId: lastRow.id,
  });
}

export async function getNavidromeSyncStatus() {
  const instanceId = process.env.NAVIDROME_INSTANCE_ID ?? "default";
  const cursor = await getCursor(instanceId);

  return {
    mode: "bridge" as const,
    instanceId,
    cursor,
    perPlayUsd: Number(process.env.NAVIDROME_PER_PLAY_USD ?? "0.0004"),
    bridgeScript: "scripts/navidrome-bridge.ts",
    syncEndpoint: "/api/connectors/navidrome/sync",
  };
}
