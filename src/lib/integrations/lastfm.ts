import { env, isConfigured } from "@/lib/integrations/config";

export function isLastFmConfigured(): boolean {
  return isConfigured("LASTFM_API_KEY") && isConfigured("LASTFM_USERNAME");
}

/** Optional cross-validation — Navidrome can scrobble to Last.fm when enabled. */
export async function pingLastFm(): Promise<{ ok: boolean; message: string }> {
  const key = env("LASTFM_API_KEY");
  const user = env("LASTFM_USERNAME");
  if (!key || !user) {
    return { ok: false, message: "LASTFM_API_KEY + LASTFM_USERNAME not set" };
  }

  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "user.getrecenttracks");
    url.searchParams.set("user", user);
    url.searchParams.set("api_key", key);
    url.searchParams.set("limit", "5");
    url.searchParams.set("format", "json");

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "RESOLVE/1.0" },
    });
    if (!res.ok) return { ok: false, message: `Last.fm HTTP ${res.status}` };

    const json = (await res.json()) as {
      error?: number;
      message?: string;
      recenttracks?: { track?: unknown[] };
    };
    if (json.error) {
      return { ok: false, message: json.message ?? `Last.fm error ${json.error}` };
    }

    const count = json.recenttracks?.track?.length ?? 0;
    return {
      ok: true,
      message: `Last.fm connected · ${count} recent track${count === 1 ? "" : "s"}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Last.fm unreachable",
    };
  }
}
