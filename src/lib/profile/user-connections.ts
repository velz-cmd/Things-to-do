import type { User } from "@prisma/client";

export type ConnectPlatform = "gmail" | "listenbrainz" | "navidrome";

export function userListenBrainzConfigured(user: Pick<User, "listenbrainzUsername">): boolean {
  return Boolean(user.listenbrainzUsername?.trim());
}

export function userNavidromeConfigured(
  user: Pick<User, "navidromeUrl" | "navidromeUsername" | "navidromePassword">,
): boolean {
  return Boolean(
    user.navidromeUrl?.trim() &&
      user.navidromeUsername?.trim() &&
      user.navidromePassword?.trim(),
  );
}

export async function validateListenBrainzCredentials(
  username: string,
  token?: string,
): Promise<{ ok: boolean; message: string }> {
  const user = username.trim();
  if (!user) return { ok: false, message: "Username is required" };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RESOLVE/1.0",
  };
  if (token?.trim()) headers.Authorization = `Token ${token.trim()}`;

  try {
    if (token?.trim()) {
      const validate = await fetch("https://api.listenbrainz.org/1/validate-token", {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!validate.ok) {
        return { ok: false, message: "ListenBrainz token is invalid" };
      }
    }

    const res = await fetch(
      `https://api.listenbrainz.org/1/user/${encodeURIComponent(user)}/listens?count=1`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      return { ok: false, message: `ListenBrainz user not found (HTTP ${res.status})` };
    }

    return { ok: true, message: "ListenBrainz connected" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "ListenBrainz unreachable",
    };
  }
}

export async function validateNavidromeCredentials(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const base = url.trim().replace(/\/$/, "");
  if (!base) return { ok: false, message: "Navidrome URL is required" };
  if (!username.trim() || !password) {
    return { ok: false, message: "Username and password are required" };
  }

  try {
    new URL(base);
  } catch {
    return { ok: false, message: "Invalid Navidrome URL" };
  }

  const crypto = await import("crypto");
  const salt = crypto.randomBytes(8).toString("hex");
  const token = crypto.createHash("md5").update(password + salt).digest("hex");
  const params = new URLSearchParams({
    u: username.trim(),
    t: token,
    s: salt,
    v: "1.16.1",
    c: "resolve",
    f: "json",
  });

  try {
    const res = await fetch(`${base}/rest/ping?${params}`, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json", "User-Agent": "RESOLVE/1.0" },
    });
    if (!res.ok) return { ok: false, message: `Navidrome HTTP ${res.status}` };

    const json = (await res.json()) as {
      "subsonic-response"?: { status?: string; error?: { message?: string } };
    };
    if (json["subsonic-response"]?.status === "ok") {
      return { ok: true, message: "Navidrome connected" };
    }
    return {
      ok: false,
      message: json["subsonic-response"]?.error?.message ?? "Navidrome ping failed",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Navidrome unreachable",
    };
  }
}

export const DISCONNECT_FIELDS: Record<
  ConnectPlatform,
  Partial<
    Pick<
      User,
      | "gmailConnected"
      | "gmailRefreshToken"
      | "listenbrainzUsername"
      | "listenbrainzToken"
      | "navidromeUrl"
      | "navidromeUsername"
      | "navidromePassword"
    >
  >
> = {
  gmail: { gmailConnected: false, gmailRefreshToken: null },
  listenbrainz: { listenbrainzUsername: null, listenbrainzToken: null },
  navidrome: { navidromeUrl: null, navidromeUsername: null, navidromePassword: null },
};
