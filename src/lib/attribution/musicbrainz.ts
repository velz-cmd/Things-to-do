const USER_AGENT = "RESOLVE/1.0 (https://resolve-task.vercel.app)";

export type MusicCredit = {
  role: string;
  name: string;
  mbid?: string;
  payeeKeyType: string;
};

const ROLE_TO_PAYEE: Record<string, string> = {
  "primary artist": "listen_artist",
  artist: "listen_artist",
  "featured artist": "listen_artist",
  composer: "listen_composer",
  lyricist: "listen_writer",
  writer: "listen_writer",
  producer: "listen_producer",
  conductor: "listen_conductor",
  publisher: "listen_publisher",
  engineer: "listen_producer",
};

function payeeKeyTypeForRole(role: string): string {
  const key = role.toLowerCase();
  return ROLE_TO_PAYEE[key] ?? "listen_credit";
}

type MbRecording = {
  id?: string;
  title?: string;
  "artist-credit"?: { artist?: { name?: string; id?: string } }[];
  relations?: { type?: string; artist?: { name?: string; id?: string } }[];
};

async function mbFetch<T>(path: string): Promise<T | null> {
  try {
    await new Promise((r) => setTimeout(r, 1100));
    const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function resolveRecordingCredits(input: {
  recordingMbid?: string;
  artistName?: string;
  trackTitle?: string;
}): Promise<MusicCredit[]> {
  let recording: MbRecording | null = null;

  if (input.recordingMbid) {
    recording = await mbFetch<MbRecording>(
      `/recording/${encodeURIComponent(input.recordingMbid)}?inc=artist-rels&fmt=json`,
    );
  } else if (input.artistName && input.trackTitle) {
    const q = encodeURIComponent(`artist:"${input.artistName}" AND recording:"${input.trackTitle}"`);
    const search = await mbFetch<{ recordings?: MbRecording[] }>(
      `/recording?query=${q}&limit=1&fmt=json`,
    );
    recording = search?.recordings?.[0] ?? null;
    if (recording?.id) {
      recording = await mbFetch<MbRecording>(
        `/recording/${recording.id}?inc=artist-rels&fmt=json`,
      );
    }
  }

  const credits: MusicCredit[] = [];
  const seen = new Set<string>();

  function add(role: string, name: string, mbid?: string) {
    const key = `${role}:${name.toLowerCase()}`;
    if (!name.trim() || seen.has(key)) return;
    seen.add(key);
    credits.push({
      role,
      name: name.trim(),
      mbid,
      payeeKeyType: payeeKeyTypeForRole(role),
    });
  }

  if (!recording) {
    if (input.artistName) {
      add("primary artist", input.artistName);
    }
    return credits;
  }

  for (const ac of recording["artist-credit"] ?? []) {
    if (ac.artist?.name) add("primary artist", ac.artist.name, ac.artist.id);
  }

  for (const rel of recording.relations ?? []) {
    if (rel.artist?.name && rel.type) {
      add(rel.type.replace(/-/g, " "), rel.artist.name, rel.artist.id);
    }
  }

  if (!credits.length && input.artistName) {
    add("primary artist", input.artistName);
  }

  return credits;
}

/** Split per-play amount across credited roles. */
export function splitPlayAmount(
  totalUsd: number,
  credits: MusicCredit[],
): { credit: MusicCredit; amountUsd: number; weight: number }[] {
  if (!credits.length) return [];

  const weights = credits.map((c) => {
    if (c.payeeKeyType === "listen_artist") return 0.4;
    if (c.payeeKeyType === "listen_composer" || c.payeeKeyType === "listen_writer") {
      return 0.15;
    }
    if (c.payeeKeyType === "listen_producer") return 0.15;
    return 0.05;
  });

  const sum = weights.reduce((s, w) => s + w, 0);
  return credits.map((credit, i) => ({
    credit,
    weight: weights[i]! / sum,
    amountUsd: Math.round((totalUsd * (weights[i]! / sum)) * 10000) / 10000,
  }));
}
