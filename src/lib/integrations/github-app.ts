import "server-only";

import { createSign } from "node:crypto";
import { env } from "@/lib/integrations/config";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export type GithubInstallation = {
  id: number;
  account: {
    id: number;
    login: string;
    type: string;
    avatar_url?: string | null;
  };
  app_slug?: string;
  repository_selection?: "all" | "selected";
  permissions?: Record<string, string>;
  suspended_at?: string | null;
};

export type GithubInstallationRepository = {
  id: number;
  fullName: string;
  private: boolean;
  permissions: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

export function githubAppId() {
  return env("GITHUB_APP_ID");
}

export function githubAppSlug() {
  return env("GITHUB_APP_SLUG") ?? env("NEXT_PUBLIC_GITHUB_APP_SLUG");
}

export function githubAppPrivateKey() {
  const raw = env("GITHUB_APP_PRIVATE_KEY")?.replaceAll("\\n", "\n");
  if (raw) return raw;
  const encoded = env("GITHUB_APP_PRIVATE_KEY_BASE64");
  if (!encoded) return undefined;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
    return decoded.includes("PRIVATE KEY") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function githubAppInstallConfigured() {
  return Boolean(env("GITHUB_APP_INSTALL_URL") || githubAppSlug());
}

export function githubAppServerConfigured() {
  return Boolean(githubAppId() && githubAppPrivateKey());
}

export function githubAppInstallationCallbackUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/connectors/github/callback`;
}

export function buildGithubAppInstallUrl(state: string) {
  const explicit = env("GITHUB_APP_INSTALL_URL");
  const base =
    explicit ??
    (githubAppSlug()
      ? `https://github.com/apps/${encodeURIComponent(githubAppSlug()!)}/installations/new`
      : null);
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("state", state);
  return url.toString();
}

export function createGithubAppJwt(now = Math.floor(Date.now() / 1_000)) {
  const appId = githubAppId();
  const privateKey = githubAppPrivateKey();
  if (!appId || !privateKey) throw new Error("github_app_server_not_configured");

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(privateKey))}`;
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "RESOLVE/1.0",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function githubJson<T>(url: string, token: string, timeoutMs = 8_000): Promise<T> {
  const response = await fetch(url, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`github_app_http_${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Verify that an installation belongs to the user who completed GitHub App
 * authorization. The token is used only during the callback and is not stored.
 */
export async function loadGithubInstallationForUser(
  accessToken: string,
  installationId: number,
) {
  const [installations, repositoryPayload] = await Promise.all([
    githubJson<{ installations?: GithubInstallation[] }>(
      `${GITHUB_API}/user/installations?per_page=100`,
      accessToken,
    ),
    githubJson<{
      repositories?: Array<{
        id: number;
        full_name: string;
        private: boolean;
        permissions?: GithubInstallationRepository["permissions"];
      }>;
    }>(
      `${GITHUB_API}/user/installations/${installationId}/repositories?per_page=100`,
      accessToken,
    ),
  ]);

  const installation = installations.installations?.find(
    (row) => row.id === installationId,
  );
  if (!installation) throw new Error("github_installation_not_owned_by_user");
  if (installation.suspended_at) throw new Error("github_installation_suspended");

  const repositories = (repositoryPayload.repositories ?? []).map(
    (repository): GithubInstallationRepository => ({
      id: repository.id,
      fullName: repository.full_name,
      private: repository.private,
      permissions: repository.permissions ?? {},
    }),
  );

  return { installation, repositories };
}

export async function loadGithubInstallationRepositoriesAsApp(installationId: number) {
  const jwt = createGithubAppJwt();
  const tokenResponse = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(jwt),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    },
  );
  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    token?: string;
  };
  if (!tokenResponse.ok || !tokenPayload.token) {
    throw new Error(`github_installation_token_http_${tokenResponse.status}`);
  }

  const repositoryPayload = await githubJson<{
    repositories?: Array<{
      id: number;
      full_name: string;
      private: boolean;
      permissions?: GithubInstallationRepository["permissions"];
    }>;
  }>(
    `${GITHUB_API}/installation/repositories?per_page=100`,
    tokenPayload.token,
  );

  return (repositoryPayload.repositories ?? []).map(
    (repository): GithubInstallationRepository => ({
      id: repository.id,
      fullName: repository.full_name,
      private: repository.private,
      permissions: repository.permissions ?? {},
    }),
  );
}

export async function findGithubAppInstallationForIdentity(input: {
  githubId: string;
  githubLogin?: string | null;
}) {
  const installations = await githubJson<GithubInstallation[]>(
    `${GITHUB_API}/app/installations?per_page=100`,
    createGithubAppJwt(),
  );
  const login = input.githubLogin?.trim().replace(/^@/, "").toLowerCase();
  return (
    installations.find((installation) => String(installation.account.id) === input.githubId) ??
    installations.find(
      (installation) =>
        Boolean(login) && installation.account.login.toLowerCase() === login,
    ) ??
    null
  );
}

export async function loadGithubAppInstallationAsApp(installationId: number) {
  return githubJson<GithubInstallation>(
    `${GITHUB_API}/app/installations/${installationId}`,
    createGithubAppJwt(),
  );
}
