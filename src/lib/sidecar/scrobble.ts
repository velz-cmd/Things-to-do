import { resolvePayee } from "@/lib/registry/resolvers";

const MIN_DURATION_SEC = 30;
const DEFAULT_PER_PLAY_USD = 0.0045;

export type ScrobbleInput = {
  musicbrainzId?: string;
  artistName?: string;
  trackTitle?: string;
  durationSec: number;
  mediaFileId?: string;
  listenerId?: string;
  instanceUrl?: string;
};

export type ScrobbleResult = {
  settled: boolean;
  skipped: boolean;
  reason?: string;
  amountUsd: number;
  payee?: {
    wallet: string;
    name: string | null;
    attribution: string;
    confidence: number;
  };
  event?: {
    type: string;
    platformId: string;
    payload: Record<string, unknown>;
  };
};

export async function processScrobbleEvent(input: ScrobbleInput): Promise<ScrobbleResult> {
  if (input.durationSec < MIN_DURATION_SEC) {
    return {
      settled: false,
      skipped: true,
      reason: `Play under ${MIN_DURATION_SEC}s — not counted (skip-as-royalty)`,
      amountUsd: 0,
    };
  }

  if (!input.musicbrainzId && !input.artistName) {
    return {
      settled: false,
      skipped: true,
      reason: "musicbrainzId or artistName required to resolve payee",
      amountUsd: 0,
    };
  }

  const payee = await resolvePayee({
    platform: "navidrome",
    platformId: input.musicbrainzId ?? `artist-${input.artistName?.toLowerCase().replace(/\s+/g, "-")}`,
    payload: {
      musicbrainzId: input.musicbrainzId,
      mbid: input.musicbrainzId,
      artist: input.artistName,
    },
  });

  if (!payee.wallet) {
    return {
      settled: false,
      skipped: true,
      reason: input.musicbrainzId
        ? `Artist ${input.musicbrainzId} not in payee registry`
        : "Artist not in payee registry — register at /music",
      amountUsd: 0,
    };
  }

  const amountUsd =
    Number(process.env.SCROBBLE_RATE_USD ?? DEFAULT_PER_PLAY_USD) || DEFAULT_PER_PLAY_USD;

  return {
    settled: true,
    skipped: false,
    amountUsd,
    payee: {
      wallet: payee.wallet,
      name: payee.payeeName,
      attribution: payee.attribution,
      confidence: payee.confidence,
    },
    event: {
      type: "scrobble_verified",
      platformId: input.musicbrainzId ?? payee.attribution,
      payload: {
        durationSec: input.durationSec,
        mediaFileId: input.mediaFileId,
        trackTitle: input.trackTitle,
        artistName: input.artistName,
        listenerId: input.listenerId,
        instanceUrl: input.instanceUrl,
        musicbrainzId: input.musicbrainzId,
      },
    },
  };
}
