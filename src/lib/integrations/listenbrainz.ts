import { env, isConfigured } from "@/lib/integrations/config";

export type ListenBrainzListen = {
  listenedAt: string;
  artistName: string;
  trackTitle: string;
  recordingMbid?: string;
  trackMbid?: string;
};

export function isListenBrainzConfigured(): boolean {
  return isConfigured("LISTENBRAINZ_USERNAME");
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RESOLVE/1.0",
  };
  const token = env("LISTENBRAINZ_TOKEN");
  if (token) h.Authorization = `Token ${token}`;
  return h;
}

function username(): string | undefined {
  return env("LISTENBRAINZ_USERNAME");
}

/** Validate token + fetch recent listens — Navidrome scrobbles land here when enabled. */
export async function pingListenBrainz(): Promise<{ ok: boolean; message: string }> {
  const user = username();
  if (!user) return { ok: false, message: "LISTENBRAINZ_USERNAME not set" };

  try {
    const token = env("LISTENBRAINZ_TOKEN");
    if (token) {
      const validate = await fetch("https://api.listenbrainz.org/1/validate-token", {
        headers: headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!validate.ok) {
        return { ok: false, message: `ListenBrainz token invalid (HTTP ${validate.status})` };
      }
    }

    const res = await fetch(
      `https://api.listenbrainz.org/1/user/${encodeURIComponent(user)}/listens?count=5`,
      { headers: headers(), signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      return { ok: false, message: `ListenBrainz HTTP ${res.status}` };
    }

    const json = (await res.json()) as {
      payload?: { listens?: { listened_at?: number }[] };
    };
    const count = json.payload?.listens?.length ?? 0;
    const latest = json.payload?.listens?.[0]?.listened_at;
    const when =
      latest != null ? new Date(latest * 1000).toISOString().slice(0, 16).replace("T", " ") : "none";

    return {
      ok: true,
      message: `ListenBrainz connected · ${count} recent listen${count === 1 ? "" : "s"} · latest ${when}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "ListenBrainz unreachable",
    };
  }
}

/** Pull listens for music authorization ingest (Navidrome → ListenBrainz → RESOLVE). */
export async function fetchListenBrainzListens(
  count = 50,
  options?: { username?: string; token?: string | null },
): Promise<ListenBrainzListen[]> {
  const user = options?.username?.trim() || username();
  if (!user) return [];

  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RESOLVE/1.0",
  };
  const token = options?.token?.trim() || env("LISTENBRAINZ_TOKEN");
  if (token) h.Authorization = `Token ${token}`;

  const res = await fetch(
    `https://api.listenbrainz.org/1/user/${encodeURIComponent(user)}/listens?count=${count}`,
    { headers: h, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) return [];

  const json = (await res.json()) as {
    payload?: {
      listens?: {
        listened_at?: number;
        track_metadata?: {
          artist_name?: string;
          track_name?: string;
          recording_mbid?: string;
          track_mbid?: string;
        };
      }[];
    };
  };

  return (json.payload?.listens ?? [])
    .filter((l) => l.listened_at && l.track_metadata?.artist_name)
    .map((l) => ({
      listenedAt: new Date((l.listened_at ?? 0) * 1000).toISOString(),
      artistName: l.track_metadata!.artist_name!,
      trackTitle: l.track_metadata?.track_name ?? "Unknown",
      recordingMbid: l.track_metadata?.recording_mbid,
      trackMbid: l.track_metadata?.track_mbid,
    }));
}
