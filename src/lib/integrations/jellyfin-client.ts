export type JellyfinCredentials = {
  url: string;
  accessToken: string;
};

export type JellyfinNowPlaying = {
  sessionId: string;
  userName: string;
  itemId: string;
  title: string;
  type: string;
  seriesName?: string;
  positionTicks: number;
  runTimeTicks?: number;
};

type JellyfinSession = {
  Id?: string;
  UserName?: string;
  NowPlayingItem?: {
    Id?: string;
    Name?: string;
    Type?: string;
    SeriesName?: string;
    RunTimeTicks?: number;
  };
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
  };
};

function apiBase(url: string) {
  return url.replace(/\/$/, "");
}

export async function authenticateJellyfin(input: {
  url: string;
  username: string;
  password: string;
}): Promise<{ ok: boolean; accessToken?: string; message: string }> {
  try {
    const res = await fetch(`${apiBase(input.url)}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "RESOLVE/1.0",
      },
      body: JSON.stringify({
        Username: input.username,
        Pw: input.password,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { AccessToken?: string; Message?: string };
    if (!res.ok || !data.AccessToken) {
      return { ok: false, message: data.Message ?? `Jellyfin auth HTTP ${res.status}` };
    }
    return { ok: true, accessToken: data.AccessToken, message: "Jellyfin connected" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Jellyfin unreachable",
    };
  }
}

export async function getJellyfinNowPlaying(
  creds: JellyfinCredentials,
): Promise<JellyfinNowPlaying[]> {
  const res = await fetch(
    `${apiBase(creds.url)}/Sessions?activeWithinSeconds=120&nowPlaying=true`,
    {
      headers: {
        Authorization: `MediaBrowser Token="${creds.accessToken}"`,
        Accept: "application/json",
        "User-Agent": "RESOLVE/1.0",
      },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!res.ok) throw new Error(`Jellyfin sessions HTTP ${res.status}`);

  const sessions = (await res.json()) as JellyfinSession[];
  const out: JellyfinNowPlaying[] = [];

  for (const s of sessions) {
    const item = s.NowPlayingItem;
    if (!item?.Id || !s.Id) continue;
    if (s.PlayState?.IsPaused) continue;
    out.push({
      sessionId: s.Id,
      userName: s.UserName ?? "unknown",
      itemId: item.Id,
      title: item.Name ?? item.Id,
      type: item.Type ?? "Video",
      seriesName: item.SeriesName,
      positionTicks: s.PlayState?.PositionTicks ?? 0,
      runTimeTicks: item.RunTimeTicks,
    });
  }

  return out;
}

export function jellyfinTicksToSeconds(ticks: number): number {
  return Math.floor(ticks / 10_000_000);
}
