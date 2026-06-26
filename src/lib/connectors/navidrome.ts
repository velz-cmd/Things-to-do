import type { SettlementInputEvent } from "@/lib/authorization/types";

/** Navidrome / Subsonic scrobble → normalized SettlementInputEvent */
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
