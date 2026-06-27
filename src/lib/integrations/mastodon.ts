import { env, isConfigured } from "@/lib/integrations/config";

export type MastodonAccount = {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  url: string;
};

export function isMastodonConfigured(): boolean {
  return isConfigured("MASTODON_INSTANCE_URL") && isConfigured("MASTODON_ACCESS_TOKEN");
}

function baseUrl(): string {
  return env("MASTODON_INSTANCE_URL")!.replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env("MASTODON_ACCESS_TOKEN")}`,
    Accept: "application/json",
  };
}

export async function pingMastodon(): Promise<{ ok: boolean; message: string }> {
  if (!isMastodonConfigured()) {
    return { ok: false, message: "MASTODON_INSTANCE_URL + MASTODON_ACCESS_TOKEN not set" };
  }
  try {
    const res = await fetch(`${baseUrl()}/api/v1/accounts/verify_credentials`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, message: `Mastodon HTTP ${res.status}` };
    const json = (await res.json()) as { acct?: string; followers_count?: number };
    return {
      ok: true,
      message: `Mastodon connected · @${json.acct ?? "account"} · ${json.followers_count ?? 0} followers`,
    };
  } catch {
    return { ok: false, message: "Mastodon unreachable" };
  }
}

export async function getMastodonAccount(): Promise<MastodonAccount | null> {
  if (!isMastodonConfigured()) return null;
  try {
    const res = await fetch(`${baseUrl()}/api/v1/accounts/verify_credentials`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      id: string;
      username: string;
      display_name?: string;
      followers_count?: number;
      url?: string;
    };
    return {
      id: json.id,
      username: json.username,
      displayName: json.display_name ?? json.username,
      followers: json.followers_count ?? 0,
      url: json.url ?? `${baseUrl()}/@${json.username}`,
    };
  } catch {
    return null;
  }
}
