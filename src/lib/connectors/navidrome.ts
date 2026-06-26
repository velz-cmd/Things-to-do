import type { SettlementInputEvent } from "@/lib/connectors/types";

/** Navidrome / Subsonic scrobble → settlement input (RFP #1). */
export function scrobbleToSettlementEvent(input: {
  mediaFileId: string;
  userId: string;
  submissionTime: string;
  artistName?: string;
  durationSec?: number;
  perPlayUsd?: number;
}): SettlementInputEvent {
  const duration = input.durationSec ?? 0;
  const gated = duration >= 30;
  const amountUsd = gated ? (input.perPlayUsd ?? 0.0004) : 0;

  return {
    connectorId: "navidrome",
    eventType: "scrobble.play",
    occurredAt: input.submissionTime,
    payeeKeys: [
      {
        type: "listen_artist",
        value: input.artistName ?? input.mediaFileId,
      },
    ],
    evidenceRefs: [`scrobble:${input.mediaFileId}:${input.userId}:${input.submissionTime}`],
    amountUsd,
    rawMetadata: input,
  };
}
