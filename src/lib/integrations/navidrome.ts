import crypto from "crypto";
import { env, isConfigured } from "@/lib/integrations/config";

const CLIENT = "resolve";

export function isNavidromeConfigured(): boolean {
  return (
    isConfigured("NAVIDROME_URL") &&
    isConfigured("NAVIDROME_USERNAME") &&
    isConfigured("NAVIDROME_PASSWORD")
  );
}

function baseUrl(): string {
  return env("NAVIDROME_URL")!.replace(/\/$/, "");
}

function authParams(): Record<string, string> {
  const password = env("NAVIDROME_PASSWORD")!;
  const salt = crypto.randomBytes(8).toString("hex");
  const token = crypto.createHash("md5").update(password + salt).digest("hex");
  return {
    u: env("NAVIDROME_USERNAME")!,
    t: token,
    s: salt,
    v: "1.16.1",
    c: CLIENT,
    f: "json",
  };
}

function restUrl(endpoint: string, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...authParams(), ...extra });
  return `${baseUrl()}/rest/${endpoint}?${q}`;
}

type SubsonicResponse = {
  "subsonic-response"?: {
    status?: string;
    version?: string;
    error?: { message?: string };
    openSubsonic?: boolean;
    nowPlaying?: {
      entry?: { id?: string; title?: string; artist?: string; username?: string }[];
    };
  };
};

async function subsonicGet(
  endpoint: string,
  extra?: Record<string, string>,
): Promise<SubsonicResponse> {
  const res = await fetch(restUrl(endpoint, extra), {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json", "User-Agent": "RESOLVE/1.0" },
  });
  if (!res.ok) throw new Error(`Navidrome HTTP ${res.status}`);
  return res.json() as Promise<SubsonicResponse>;
}

/** Subsonic ping — proves NAVIDROME_URL + credentials work from Vercel. */
export async function pingNavidrome(): Promise<{ ok: boolean; message: string }> {
  if (!isNavidromeConfigured()) {
    return { ok: false, message: "NAVIDROME_URL + USERNAME + PASSWORD not set" };
  }
  try {
    const json = await subsonicGet("ping");
    const body = json["subsonic-response"];
    if (body?.status === "ok") {
      return {
        ok: true,
        message: `Navidrome connected · Subsonic ${body.version ?? "1.16.1"}`,
      };
    }
    return {
      ok: false,
      message: body?.error?.message ?? "Navidrome ping failed",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Navidrome unreachable",
    };
  }
}

/** Live plays from Navidrome — useful when scrobble history is not exposed via REST. */
export async function getNavidromeNowPlaying(): Promise<
  { id: string; title: string; artist: string; username: string }[]
> {
  if (!isNavidromeConfigured()) return [];
  try {
    const json = await subsonicGet("getNowPlaying");
    const entries = json["subsonic-response"]?.nowPlaying?.entry ?? [];
    return entries
      .filter((e) => e.id && e.title)
      .map((e) => ({
        id: e.id!,
        title: e.title!,
        artist: e.artist ?? "Unknown",
        username: e.username ?? env("NAVIDROME_USERNAME")!,
      }));
  } catch {
    return [];
  }
}
