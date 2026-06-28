import type { SettlementInputEvent } from "@/lib/authorization/types";
import { musicScrobbleToSettlementEvents } from "@/lib/connectors/music-pipeline";

export type { MusicScrobbleInput } from "@/lib/connectors/music-pipeline";

/** Navidrome scrobble → MusicBrainz credit chain → SettlementInputEvents */
export async function navidromeScrobbleToSettlementEvents(input: {
  mediaFileId: string;
  userId: string;
  submissionTime: string;
  artistName?: string;
  trackTitle?: string;
  recordingMbid?: string;
  durationSec?: number;
  instanceId?: string;
  perPlayUsd?: number;
  listenBrainzUser?: string;
  missionId?: string;
}): Promise<SettlementInputEvent[]> {
  return musicScrobbleToSettlementEvents({
    ...input,
    instanceId: input.instanceId ?? "default",
  });
}

/** @deprecated Use navidromeScrobbleToSettlementEvents — returns primary event only */
export function navidromeScrobbleToSettlementInput(input: {
  mediaFileId: string;
  userId: string;
  submissionTime: string;
  artistName?: string;
  durationSec?: number;
  instanceId?: string;
  perPlayUsd?: number;
}): SettlementInputEvent | null {
  const duration = input.durationSec ?? 0;
  if (duration > 0 && duration < 30) return null;
  const artist = (input.artistName ?? input.mediaFileId).trim();
  const instance = input.instanceId ?? "default";
  const day = input.submissionTime.slice(0, 10);
  const missionId = `navidrome-${instance}-${input.userId}-${day}`;
  const idempotencyKey = `navidrome:${input.mediaFileId}:${input.userId}:${input.submissionTime}`;
  return {
    connectorId: "navidrome",
    eventType: "scrobble.play",
    occurredAt: input.submissionTime,
    missionId,
    idempotencyKey,
    payeeKeyType: "listen_artist",
    payeeKey: artist.toLowerCase(),
    amountUsd: input.perPlayUsd ?? 0.0004,
    proofHash: idempotencyKey.slice(0, 64),
    confidence: 0.9,
    contextLabel: `navidrome/${instance}`,
    evidenceRefs: [idempotencyKey],
    rawMetadata: input,
  };
}
