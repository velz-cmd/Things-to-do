import type { SettlementInputEvent } from "@/lib/authorization/types";

export type VideoWatchInput = {
  itemId: string;
  userId: string;
  watchedAt: string;
  title: string;
  mediaType?: string;
  creatorName?: string;
  durationSec?: number;
  instanceId?: string;
  perWatchUsd?: number;
  missionId?: string;
};

/** Jellyfin / self-hosted video watch → video.watch authorization. */
export async function videoWatchToSettlementEvents(
  input: VideoWatchInput,
): Promise<SettlementInputEvent[]> {
  const duration = input.durationSec ?? 0;
  if (duration > 0 && duration < 60) return [];

  const instance = input.instanceId ?? "default";
  const day = input.watchedAt.slice(0, 10);
  const missionId = input.missionId ?? `video-${instance}-${input.userId}-${day}`;
  const baseKey = `jellyfin:${input.itemId}:${input.userId}:${input.watchedAt}`;
  const perWatchUsd = input.perWatchUsd ?? 0.001;
  const creator = (input.creatorName ?? input.title).trim().toLowerCase();

  return [
    {
      connectorId: "jellyfin",
      eventType: "video.watch",
      occurredAt: input.watchedAt,
      missionId,
      idempotencyKey: baseKey,
      payeeKeyType: "video_creator",
      payeeKey: creator,
      amountUsd: perWatchUsd,
      proofHash: baseKey.slice(0, 64),
      confidence: 0.88,
      contextLabel: `jellyfin/${instance}`,
      evidenceRefs: [baseKey],
      rawMetadata: input,
    },
  ];
}
