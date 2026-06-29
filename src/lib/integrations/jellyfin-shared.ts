/** Shared Jellyfin API headers — required for AuthenticateByName on many servers. */

const CLIENT = "RESOLVE";
const DEVICE = "Web";
const DEVICE_ID = "resolve-web-connect";
const VERSION = "1.0.0";

export function jellyfinEmbyAuthorizationHeader(): string {
  return `MediaBrowser Client="${CLIENT}", Device="${DEVICE}", DeviceId="${DEVICE_ID}", Version="${VERSION}"`;
}

export function jellyfinAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Emby-Authorization": jellyfinEmbyAuthorizationHeader(),
  };
  if (accessToken) {
    headers.Authorization = `MediaBrowser Token="${accessToken}"`;
  }
  return headers;
}

/** Try common local URL variants (localhost vs 127.0.0.1). */
export function jellyfinUrlVariants(raw: string): string[] {
  const trimmed = raw.trim().replace(/\/$/, "");
  const variants = new Set<string>([trimmed]);

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "localhost") {
      variants.add(`${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ""}`);
    }
    if (parsed.hostname === "127.0.0.1") {
      variants.add(`${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`);
    }
  } catch {
    /* ignore */
  }

  return [...variants];
}

export const JELLYFIN_SESSION_KEY = "resolve_jellyfin_session";

export type JellyfinSessionCreds = {
  url: string;
  username: string;
  password: string;
  accessToken?: string;
};

export function saveJellyfinSession(creds: JellyfinSessionCreds) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(JELLYFIN_SESSION_KEY, JSON.stringify(creds));
}

export function loadJellyfinSession(): JellyfinSessionCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(JELLYFIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JellyfinSessionCreds;
  } catch {
    return null;
  }
}

export function clearJellyfinSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(JELLYFIN_SESSION_KEY);
}
