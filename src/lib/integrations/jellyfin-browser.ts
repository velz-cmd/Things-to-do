/** Browser-only Jellyfin calls — runs on the user's machine (can reach localhost). */

export type JellyfinBrowserAuth = {
  accessToken: string;
  userName?: string;
};

export type JellyfinBrowserWatch = {
  itemId: string;
  title: string;
  mediaType?: string;
  creatorName?: string;
  durationSec: number;
  sessionId: string;
};

function base(url: string) {
  return url.replace(/\/$/, "");
}

function formatBrowserError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
    return (
      "Could not reach Jellyfin. Check the server URL (include :8096), make sure Jellyfin is running, " +
      "and open RESOLVE on the same computer where Jellyfin runs."
    );
  }
  return msg || "Jellyfin connection failed";
}

export async function authenticateJellyfinInBrowser(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: true; auth: JellyfinBrowserAuth } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${base(url)}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Username: username,
        Pw: password,
      }),
    });

    let data: { AccessToken?: string; User?: { Name?: string }; Message?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      return {
        ok: false,
        error: `Jellyfin returned an unexpected response (HTTP ${res.status}). Check the URL includes the port.`,
      };
    }

    if (!res.ok || !data.AccessToken) {
      return {
        ok: false,
        error:
          data.Message ??
          (res.status === 401 ? "Invalid Jellyfin username or password" : `Jellyfin HTTP ${res.status}`),
      };
    }

    return {
      ok: true,
      auth: { accessToken: data.AccessToken, userName: data.User?.Name ?? username },
    };
  } catch (e) {
    return { ok: false, error: formatBrowserError(e) };
  }
}

export async function fetchJellyfinNowPlayingInBrowser(
  url: string,
  accessToken: string,
): Promise<JellyfinBrowserWatch[]> {
  const res = await fetch(
    `${base(url)}/Sessions?activeWithinSeconds=120&nowPlaying=true`,
    {
      headers: {
        Authorization: `MediaBrowser Token="${accessToken}"`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`Jellyfin sessions HTTP ${res.status}`);

  const sessions = (await res.json()) as Array<{
    Id?: string;
    NowPlayingItem?: { Id?: string; Name?: string; Type?: string; SeriesName?: string };
    PlayState?: { PositionTicks?: number; IsPaused?: boolean };
  }>;

  const out: JellyfinBrowserWatch[] = [];
  for (const s of sessions) {
    const item = s.NowPlayingItem;
    if (!item?.Id || !s.Id) continue;
    if (s.PlayState?.IsPaused) continue;
    const durationSec = Math.floor((s.PlayState?.PositionTicks ?? 0) / 10_000_000);
    if (durationSec > 0 && durationSec < 60) continue;
    out.push({
      sessionId: s.Id,
      itemId: item.Id,
      title: item.Name ?? item.Id,
      mediaType: item.Type,
      creatorName: item.SeriesName ?? item.Name,
      durationSec,
    });
  }
  return out;
}
