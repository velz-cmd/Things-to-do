import {
  fetchListenBrainzListens,
  isListenBrainzConfigured,
} from "@/lib/integrations/listenbrainz";

export { isListenBrainzConfigured };

/** ListenBrainz cross-check — raises confidence when listen appears in global history. */
export async function listenBrainzConfidenceBoost(input: {
  artistName: string;
  trackTitle?: string;
  listenedAt: string;
  listenBrainzUser?: string;
}): Promise<{ confidenceDelta: number; matched: boolean }> {
  if (!isListenBrainzConfigured()) return { confidenceDelta: 0, matched: false };

  try {
    const listens = await fetchListenBrainzListens(25);
    const artist = input.artistName.toLowerCase();
    const track = input.trackTitle?.toLowerCase();

    const matched = listens.some((l) => {
      const la = l.artistName.toLowerCase();
      const lt = l.trackTitle.toLowerCase();
      if (!la.includes(artist) && !artist.includes(la)) return false;
      if (track && lt && !lt.includes(track) && !track.includes(lt)) return false;
      return true;
    });

    return matched ? { confidenceDelta: 0.08, matched: true } : { confidenceDelta: 0, matched: false };
  } catch {
    return { confidenceDelta: 0, matched: false };
  }
}
