/** Browser-only Jellyfin calls — runs on the user's machine (can reach localhost). */

import {
  jellyfinAuthHeaders,
  jellyfinUrlVariants,
  type JellyfinSessionCreds,
} from "@/lib/integrations/jellyfin-shared";

export type JellyfinBrowserAuth = {
  accessToken: string;
  userName?: string;
  url: string;
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
  const lower = msg.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return (
      "Your browser could not reach Jellyfin. Use http://127.0.0.1:8096 (not localhost), " +
      "make sure Jellyfin is running, and if Chrome asks to access your local network — click Allow."
    );
  }
  return msg || "Jellyfin connection failed";
}

async function authenticateAtUrl(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: true; auth: JellyfinBrowserAuth } | { ok: false; error: string; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${base(url)}/Users/AuthenticateByName`, {
      method: "POST",
      headers: jellyfinAuthHeaders(),
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
        error: `Jellyfin returned an unexpected response (HTTP ${res.status}). Check the URL includes :8096.`,
      };
    }

    if (!res.ok || !data.AccessToken) {
      return {
        ok: false,
        unauthorized: res.status === 401,
        error:
          data.Message ??
          (res.status === 401 ?
            "Invalid Jellyfin username or password — use the password from your Jellyfin account"
          : `Jellyfin HTTP ${res.status}`),
      };
    }

    return {
      ok: true,
      auth: {
        accessToken: data.AccessToken,
        userName: data.User?.Name ?? username,
        url: base(url),
      },
    };
  } catch (e) {
    return { ok: false, error: formatBrowserError(e) };
  }
}

/** Sign in with Jellyfin account password — tries localhost and 127.0.0.1 variants. */
export async function authenticateJellyfinInBrowser(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: true; auth: JellyfinBrowserAuth } | { ok: false; error: string }> {
  let lastError = "Could not reach Jellyfin";
  let sawUnauthorized = false;

  for (const candidate of jellyfinUrlVariants(url)) {
    const result = await authenticateAtUrl(candidate, username, password);
    if (result.ok) return result;
    lastError = result.error;
    if (result.unauthorized) sawUnauthorized = true;
  }

  if (sawUnauthorized) {
    return {
      ok: false,
      error:
        "Invalid Jellyfin username or password. Use the same password you use to sign in to Jellyfin — not an API key.",
    };
  }

  return { ok: false, error: lastError };
}

export async function fetchJellyfinNowPlayingInBrowser(
  url: string,
  accessToken: string,
): Promise<JellyfinBrowserWatch[]> {
  let lastError = "Could not reach Jellyfin";

  for (const candidate of jellyfinUrlVariants(url)) {
    try {
      const res = await fetch(
        `${base(candidate)}/Sessions?activeWithinSeconds=120&nowPlaying=true`,
        {
          headers: jellyfinAuthHeaders(accessToken),
        },
      );
      if (!res.ok) {
        lastError = `Jellyfin sessions HTTP ${res.status}`;
        continue;
      }

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
    } catch (e) {
      lastError = formatBrowserError(e);
    }
  }

  throw new Error(lastError);
}

export async function resolveJellyfinAccessToken(
  creds: JellyfinSessionCreds,
): Promise<{ url: string; accessToken: string }> {
  if (creds.accessToken?.trim()) {
    return { url: creds.url, accessToken: creds.accessToken.trim() };
  }

  const auth = await authenticateJellyfinInBrowser(creds.url, creds.username, creds.password);
  if (!auth.ok) throw new Error(auth.error);

  return { url: auth.auth.url, accessToken: auth.auth.accessToken };
}
