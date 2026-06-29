import { env, isConfigured } from "@/lib/integrations/config";
import { appOrigin } from "@/lib/integrations/musicbrainz-oauth";

const GITHUB_OAUTH_BASE = "https://github.com/login/oauth";
const GITHUB_API = "https://api.github.com";
const SCOPES = ["read:user"];

export function githubOAuthConfigured(): boolean {
  return Boolean(githubClientId() && githubClientSecret());
}

export function githubClientId(): string | undefined {
  return (
    env("GITHUB_OAUTH_CLIENT_ID") ??
    env("GITHUB_CLIENT_ID") ??
    env("GITHUB_APP_CLIENT_ID") ??
    env("NEXT_PUBLIC_GITHUB_CLIENT_ID") ??
    env("NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID")
  );
}

export function githubClientSecret(): string | undefined {
  return (
    env("GITHUB_OAUTH_CLIENT_SECRET") ??
    env("GITHUB_CLIENT_SECRET") ??
    env("GITHUB_APP_CLIENT_SECRET")
  );
}

export function githubOAuthRedirectUri(requestOrigin?: string) {
  return `${appOrigin(requestOrigin)}/api/connectors/github/callback`;
}

export function buildGithubAuthorizeUrl(state: string, requestOrigin?: string) {
  const params = new URLSearchParams({
    client_id: githubClientId()!,
    redirect_uri: githubOAuthRedirectUri(requestOrigin),
    scope: SCOPES.join(" "),
    state,
    allow_signup: "true",
  });
  return `${GITHUB_OAUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeGithubCode(code: string, requestOrigin?: string) {
  const res = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "RESOLVE/1.0",
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      code,
      redirect_uri: githubOAuthRedirectUri(requestOrigin),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "GitHub OAuth failed");
  }

  return data;
}

export type GithubUser = {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
};

export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "RESOLVE/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`GitHub user API HTTP ${res.status}`);
  }

  return res.json() as Promise<GithubUser>;
}
