import { prisma } from "@/lib/db";
import { navidromeScrobbleToSettlementEvents } from "@/lib/connectors/navidrome";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";

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
  trackTitle?: string;
  recordingMbid?: string;
  durationSec?: number;
};

/** Resolve mission scope for scrobble authorizations — program > env > day bucket */
async function resolveScrobbleMissionContext(options?: {
  missionId?: string;
  perPlayUsd?: number;
  founderUserId?: string;
}): Promise<{ missionId?: string; perPlayUsd?: number; founderUserId?: string }> {
  if (options?.missionId) {
    return {
      missionId: options.missionId,
      perPlayUsd: options.perPlayUsd,
      founderUserId: options.founderUserId,
    };
  }

  const envMission = process.env.NAVIDROME_PROGRAM_MISSION_ID?.trim();
  if (envMission) {
    return {
      missionId: envMission,
      perPlayUsd: options?.perPlayUsd ?? Number(process.env.NAVIDROME_PER_PLAY_USD ?? "0.0004"),
      founderUserId: options?.founderUserId,
    };
  }

  const activeProgram = await prisma.resolveProgram.findFirst({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    orderBy: { updatedAt: "desc" },
    include: { install: true },
  });

  if (activeProgram?.missionId) {
    let perPlayUsd = options?.perPlayUsd;
    try {
      const rules = JSON.parse(activeProgram.rulesJson) as { perPlayUsd?: number };
      perPlayUsd = perPlayUsd ?? rules.perPlayUsd;
    } catch {
      /* ignore */
    }
    return {
      missionId: activeProgram.missionId,
      perPlayUsd: perPlayUsd ?? 0.0004,
      founderUserId: activeProgram.userId,
    };
  }

  return { perPlayUsd: options?.perPlayUsd, founderUserId: options?.founderUserId };
}

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
  options?: { instanceId?: string; perPlayUsd?: number; missionId?: string; founderUserId?: string },
) {
  const instanceId = options?.instanceId ?? process.env.NAVIDROME_INSTANCE_ID ?? "default";
  const ctx = await resolveScrobbleMissionContext(options);
  const events = [];

  for (const row of rows) {
    const rowEvents = await navidromeScrobbleToSettlementEvents({
      mediaFileId: row.mediaFileId,
      userId: row.userId,
      submissionTime: row.submissionTime,
      artistName: row.artistName || undefined,
      trackTitle: row.trackTitle,
      recordingMbid: row.recordingMbid,
      durationSec: row.durationSec,
      instanceId,
      perPlayUsd: ctx.perPlayUsd ?? options?.perPlayUsd,
      missionId: ctx.missionId,
    });
    events.push(...rowEvents);
  }

  if (!events.length) {
    return { ingested: 0, skipped: rows.length, events: [] as const, missionId: ctx.missionId ?? null };
  }

  const batch = await ingestSettlementBatch(events, { founderUserId: ctx.founderUserId });

  if (batch.count > 0 && ctx.founderUserId && ctx.missionId) {
    await recordTimelineEvent({
      userId: ctx.founderUserId,
      missionId: ctx.missionId,
      eventType: "scrobble_batch",
      title: `${batch.count} plays authorized`,
      detail: `$${batch.totalUsd.toFixed(4)} owed · mission ${ctx.missionId}`,
      severity: "info",
    }).catch(() => undefined);
  }

  return {
    ingested: batch.count,
    skipped: rows.length - batch.count,
    events: batch.authorizations,
    missionId: ctx.missionId ?? batch.missionId,
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
