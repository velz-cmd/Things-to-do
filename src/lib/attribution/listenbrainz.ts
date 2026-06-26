import { env, isConfigured } from "@/lib/integrations/config";

/** ListenBrainz cross-check — raises confidence when listen appears in global history. */
export async function listenBrainzConfidenceBoost(input: {
  artistName: string;
  trackTitle?: string;
  listenedAt: string;
  listenBrainzUser?: string;
}): Promise<{ confidenceDelta: number; matched: boolean }> {
  const token = env("LISTENBRAINZ_TOKEN");
  const user = input.listenBrainzUser ?? env("LISTENBRAINZ_USERNAME");
  if (!user) return { confidenceDelta: 0, matched: false };

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "RESOLVE/1.0",
    };
    if (token) headers.Authorization = `Token ${token}`;

    const res = await fetch(
      `https://api.listenbrainz.org/1/user/${encodeURIComponent(user)}/listens?count=25`,
      { headers, next: { revalidate: 300 } },
    );
    if (!res.ok) return { confidenceDelta: 0, matched: false };

    const json = (await res.json()) as {
      payload?: {
        listens?: {
          listened_at?: string;
          track_metadata?: { artist_name?: string; track_name?: string };
        }[];
      };
    };

    const listens = json.payload?.listens ?? [];
    const artist = input.artistName.toLowerCase();
    const track = input.trackTitle?.toLowerCase();

    const matched = listens.some((l) => {
      const la = l.track_metadata?.artist_name?.toLowerCase() ?? "";
      const lt = l.track_metadata?.track_name?.toLowerCase() ?? "";
      if (!la.includes(artist) && !artist.includes(la)) return false;
      if (track && lt && !lt.includes(track) && !track.includes(lt)) return false;
      return true;
    });

    return matched ? { confidenceDelta: 0.08, matched: true } : { confidenceDelta: 0, matched: false };
  } catch {
    return { confidenceDelta: 0, matched: false };
  }
}

export function isListenBrainzConfigured(): boolean {
  return isConfigured("LISTENBRAINZ_USERNAME") || isConfigured("LISTENBRAINZ_TOKEN");
}
