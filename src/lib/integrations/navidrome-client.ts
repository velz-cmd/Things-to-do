import crypto from "crypto";

type SubsonicResponse = {
  "subsonic-response"?: {
    status?: string;
    error?: { message?: string };
    nowPlaying?: {
      entry?: {
        id?: string;
        title?: string;
        artist?: string;
        username?: string;
        duration?: number;
      }[];
    };
  };
};

export type NavidromeCredentials = {
  url: string;
  username: string;
  password: string;
};

function authParams(creds: NavidromeCredentials): Record<string, string> {
  const salt = crypto.randomBytes(8).toString("hex");
  const token = crypto.createHash("md5").update(creds.password + salt).digest("hex");
  return {
    u: creds.username,
    t: token,
    s: salt,
    v: "1.16.1",
    c: "resolve",
    f: "json",
  };
}

function restUrl(creds: NavidromeCredentials, endpoint: string, extra: Record<string, string> = {}) {
  const base = creds.url.replace(/\/$/, "");
  const q = new URLSearchParams({ ...authParams(creds), ...extra });
  return `${base}/rest/${endpoint}?${q}`;
}

async function subsonicGet(
  creds: NavidromeCredentials,
  endpoint: string,
  extra?: Record<string, string>,
): Promise<SubsonicResponse> {
  const res = await fetch(restUrl(creds, endpoint, extra), {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json", "User-Agent": "RESOLVE/1.0" },
  });
  if (!res.ok) throw new Error(`Navidrome HTTP ${res.status}`);
  return res.json() as Promise<SubsonicResponse>;
}

export async function pingNavidromeWithCredentials(
  creds: NavidromeCredentials,
): Promise<{ ok: boolean; message: string }> {
  try {
    const json = await subsonicGet(creds, "ping");
    const body = json["subsonic-response"];
    if (body?.status === "ok") {
      return { ok: true, message: "Navidrome connected" };
    }
    return { ok: false, message: body?.error?.message ?? "Navidrome ping failed" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Navidrome unreachable",
    };
  }
}

/** Live plays from a user's Navidrome — polled by RESOLVE on a schedule (no local bridge). */
export async function getNavidromeNowPlayingForUser(creds: NavidromeCredentials): Promise<
  { id: string; title: string; artist: string; username: string; durationSec: number }[]
> {
  try {
    const json = await subsonicGet(creds, "getNowPlaying");
    const entries = json["subsonic-response"]?.nowPlaying?.entry ?? [];
    return entries
      .filter((e) => e.id && e.title)
      .map((e) => ({
        id: e.id!,
        title: e.title!,
        artist: e.artist ?? "Unknown",
        username: e.username ?? creds.username,
        durationSec: e.duration ?? 0,
      }));
  } catch {
    return [];
  }
}
