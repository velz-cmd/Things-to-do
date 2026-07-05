import { createHash, randomBytes } from "crypto";
import { normalizeListenBrainzUsername } from "@/lib/identity/listenbrainz-login";
import { env, isConfigured } from "@/lib/integrations/config";

const MB_OAUTH_BASE = "https://musicbrainz.org/oauth2";
const SCOPES = ["profile"];

export function musicBrainzOAuthConfigured(): boolean {
  return isConfigured("MUSICBRAINZ_CLIENT_ID") && isConfigured("MUSICBRAINZ_CLIENT_SECRET");
}

export function appOrigin(requestOrigin?: string) {
  const fromRequest = requestOrigin?.replace(/\/$/, "");
  const configured =
    process.env.OAUTH_REDIRECT_ORIGIN?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.APP_URL?.replace(/\/$/, "");

  if (fromRequest?.includes("localhost")) return fromRequest;
  return configured ?? fromRequest ?? "http://localhost:3000";
}

export function listenBrainzOAuthRedirectUri(requestOrigin?: string) {
  return `${appOrigin(requestOrigin)}/api/connectors/listenbrainz/callback`;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildMusicBrainzAuthorizeUrl(
  state: string,
  codeChallenge: string,
  requestOrigin?: string,
) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("MUSICBRAINZ_CLIENT_ID")!,
    redirect_uri: listenBrainzOAuthRedirectUri(requestOrigin),
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${MB_OAUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeMusicBrainzCode(
  code: string,
  codeVerifier: string,
  requestOrigin?: string,
) {
  const res = await fetch(`${MB_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: listenBrainzOAuthRedirectUri(requestOrigin),
      client_id: env("MUSICBRAINZ_CLIENT_ID")!,
      client_secret: env("MUSICBRAINZ_CLIENT_SECRET")!,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "MusicBrainz OAuth failed");
  }

  return data;
}

export type MusicBrainzUserInfo = {
  sub: string;
  name?: string;
  nickname?: string;
  preferred_username?: string;
};

export async function fetchMusicBrainzUserInfo(accessToken: string): Promise<MusicBrainzUserInfo> {
  const res = await fetch(`${MB_OAUTH_BASE}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "RESOLVE/1.0",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz userinfo HTTP ${res.status}`);
  }

  return res.json() as Promise<MusicBrainzUserInfo>;
}

export function listenBrainzUsernameFromUserInfo(info: MusicBrainzUserInfo): string | null {
  return (
    normalizeListenBrainzUsername(info.preferred_username) ??
    normalizeListenBrainzUsername(info.sub) ??
    normalizeListenBrainzUsername(info.nickname) ??
    null
  );
}
