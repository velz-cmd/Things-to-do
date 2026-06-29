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

import { jellyfinAuthHeaders } from "@/lib/integrations/jellyfin-shared";

function apiBase(url: string) {
  return url.replace(/\/$/, "");
}

function formatJellyfinFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("enotfound") ||
    lower.includes("network")
  ) {
    return (
      "RESOLVE could not reach your Jellyfin server from the cloud. " +
      "Open /connect/jellyfin on the same PC as Jellyfin — your browser will sign in with your account password."
    );
  }
  return msg || "Could not connect to Jellyfin";
}

export async function authenticateJellyfin(input: {
  url: string;
  username: string;
  password: string;
}): Promise<{ ok: boolean; accessToken?: string; message: string }> {
  try {
    const res = await fetch(`${apiBase(input.url)}/Users/AuthenticateByName`, {
      method: "POST",
      headers: jellyfinAuthHeaders(),
      body: JSON.stringify({
        Username: input.username,
        Pw: input.password,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    let data: { AccessToken?: string; Message?: string };
    try {
      data = (await res.json()) as { AccessToken?: string; Message?: string };
    } catch {
      return {
        ok: false,
        message: `Jellyfin returned a non-JSON response (HTTP ${res.status}). Check the server URL includes the port, e.g. http://10.0.0.5:8096`,
      };
    }

    if (!res.ok || !data.AccessToken) {
      return {
        ok: false,
        message:
          data.Message ??
          (res.status === 401 ?
            "Invalid Jellyfin username or password"
          : `Jellyfin auth HTTP ${res.status}`),
      };
    }
    return { ok: true, accessToken: data.AccessToken, message: "Jellyfin connected" };
  } catch (e) {
    return {
      ok: false,
      message: formatJellyfinFetchError(e),
    };
  }
}

/** Store API key from Jellyfin Dashboard for local / unreachable servers. */
export function normalizeJellyfinApiKey(raw: string): string {
  return raw.trim();
}

export async function getJellyfinNowPlaying(
  creds: JellyfinCredentials,
): Promise<JellyfinNowPlaying[]> {
  const res = await fetch(
    `${apiBase(creds.url)}/Sessions?activeWithinSeconds=120&nowPlaying=true`,
    {
      headers: jellyfinAuthHeaders(creds.accessToken),
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
