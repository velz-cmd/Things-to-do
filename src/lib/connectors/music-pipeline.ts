import type { SettlementInputEvent } from "@/lib/authorization/types";
import {
  resolveRecordingCredits,
  splitPlayAmount,
} from "@/lib/attribution/musicbrainz";
import { listenBrainzConfidenceBoost } from "@/lib/attribution/listenbrainz";

export type MusicScrobbleInput = {
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
};

/** Music play → credit chain authorizations (MusicBrainz attribution). */
export async function musicScrobbleToSettlementEvents(
  input: MusicScrobbleInput & { missionId?: string },
): Promise<SettlementInputEvent[]> {
  const duration = input.durationSec ?? 0;
  if (duration > 0 && duration < 30) return [];

  const instance = input.instanceId ?? "default";
  const day = input.submissionTime.slice(0, 10);
  const missionId = input.missionId ?? `music-${instance}-${input.userId}-${day}`;
  const baseKey = `music:${input.mediaFileId}:${input.userId}:${input.submissionTime}`;
  const perPlayUsd = input.perPlayUsd ?? 0.02;

  const credits = await resolveRecordingCredits({
    recordingMbid: input.recordingMbid,
    artistName: input.artistName,
    trackTitle: input.trackTitle,
  });

  const lb = await listenBrainzConfidenceBoost({
    artistName: input.artistName ?? credits[0]?.name ?? "unknown",
    trackTitle: input.trackTitle,
    listenedAt: input.submissionTime,
    listenBrainzUser: input.listenBrainzUser,
  });

  const baseConfidence = 0.85 + lb.confidenceDelta;
  const splits = splitPlayAmount(perPlayUsd, credits);

  if (!splits.length) {
    const artist = (input.artistName ?? input.mediaFileId).trim();
    return [
      {
        connectorId: "navidrome",
        eventType: "scrobble.play",
        occurredAt: input.submissionTime,
        missionId,
        idempotencyKey: baseKey,
        payeeKeyType: "listen_artist",
        payeeKey: artist.toLowerCase(),
        amountUsd: perPlayUsd,
        proofHash: baseKey.slice(0, 64),
        confidence: baseConfidence,
        contextLabel: `music/${instance}`,
        evidenceRefs: [baseKey],
        rawMetadata: { ...input, credits: [], listenBrainz: lb },
      },
    ];
  }

  return splits.map((s, idx) => ({
    connectorId: "navidrome",
    eventType: idx === 0 ? "scrobble.play" : "scrobble.credit",
    occurredAt: input.submissionTime,
    missionId,
    idempotencyKey: `${baseKey}:${s.credit.payeeKeyType}:${s.credit.name.toLowerCase()}`,
    payeeKeyType: s.credit.payeeKeyType,
    payeeKey: s.credit.name.toLowerCase(),
    amountUsd: s.amountUsd,
    weight: s.weight,
    proofHash: baseKey.slice(0, 64),
    confidence: Math.min(0.98, baseConfidence + (lb.matched ? 0.02 : 0)),
    contextLabel: `music/${instance}`,
    evidenceRefs: [baseKey, s.credit.mbid ?? s.credit.role].filter(Boolean) as string[],
    rawMetadata: {
      role: s.credit.role,
      recordingMbid: input.recordingMbid,
      mediaFileId: input.mediaFileId,
      listenBrainz: lb,
    },
  }));
}
