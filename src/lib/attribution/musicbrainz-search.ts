const USER_AGENT = "RESOLVE/1.0 (https://resolve-self.vercel.app)";

export type MusicBrainzArtistHit = {
  mbid: string;
  name: string;
  sortName?: string;
  disambiguation?: string;
  type?: string;
};

type MbArtistSearch = {
  artists?: Array<{
    id?: string;
    name?: string;
    "sort-name"?: string;
    disambiguation?: string;
    type?: string;
  }>;
};

export async function searchMusicBrainzArtists(
  query: string,
  limit = 8,
): Promise<MusicBrainzArtistHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(q)}&limit=${limit}&fmt=json`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MbArtistSearch;
    return (data.artists ?? [])
      .filter((a) => a.id && a.name)
      .map((a) => ({
        mbid: a.id!,
        name: a.name!,
        sortName: a["sort-name"],
        disambiguation: a.disambiguation,
        type: a.type,
      }));
  } catch {
    return [];
  }
}

export async function lookupMusicBrainzArtist(
  mbid: string,
): Promise<MusicBrainzArtistHit | null> {
  if (!mbid.match(/^[a-f0-9-]{36}$/i)) return null;
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist/${encodeURIComponent(mbid)}?fmt=json`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) return null;
    const a = (await res.json()) as {
      id?: string;
      name?: string;
      "sort-name"?: string;
      disambiguation?: string;
      type?: string;
    };
    if (!a.id || !a.name) return null;
    return {
      mbid: a.id,
      name: a.name,
      sortName: a["sort-name"],
      disambiguation: a.disambiguation,
      type: a.type,
    };
  } catch {
    return null;
  }
}
