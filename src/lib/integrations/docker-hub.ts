import { env, isConfigured } from "@/lib/integrations/config";

export type DockerHubUsage = {
  namespace: string;
  repository: string;
  pullCount: number;
  starCount: number;
};

let cachedJwt: { token: string; exp: number } | null = null;

async function dockerHubToken(): Promise<string | null> {
  const username = env("DOCKER_HUB_USERNAME");
  const password = env("DOCKER_HUB_TOKEN");
  if (!username || !password) return null;

  if (cachedJwt && cachedJwt.exp > Date.now() + 60_000) {
    return cachedJwt.token;
  }

  try {
    const res = await fetch("https://hub.docker.com/v2/users/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    if (!json.token) return null;
    cachedJwt = { token: json.token, exp: Date.now() + 9 * 60 * 60 * 1000 };
    return json.token;
  } catch {
    return null;
  }
}

async function dockerFetch<T>(url: string): Promise<T | null> {
  const token = await dockerHubToken();
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Guess Docker Hub repo from GitHub owner/repo (common pattern: docker.io/owner/repo). */
export async function fetchDockerUsageForGithubRepo(
  owner: string,
  repo: string,
): Promise<DockerHubUsage | null> {
  const candidates = [
    { namespace: owner.toLowerCase(), repository: repo.toLowerCase() },
    { namespace: owner.toLowerCase(), repository: `${repo.toLowerCase()}-server` },
  ];

  for (const c of candidates) {
    const data = await dockerFetch<{
      pull_count?: number;
      star_count?: number;
      name?: string;
    }>(`https://hub.docker.com/v2/repositories/${c.namespace}/${c.repository}/`);

    if (data?.pull_count != null) {
      return {
        namespace: c.namespace,
        repository: c.repository,
        pullCount: data.pull_count,
        starCount: data.star_count ?? 0,
      };
    }
  }
  return null;
}

export function isDockerHubConfigured(): boolean {
  return isConfigured("DOCKER_HUB_USERNAME") && isConfigured("DOCKER_HUB_TOKEN");
}

export async function pingDockerHub(): Promise<{ ok: boolean; message: string }> {
  if (!isDockerHubConfigured()) {
    return { ok: false, message: "DOCKER_HUB_USERNAME + DOCKER_HUB_TOKEN not set" };
  }
  const token = await dockerHubToken();
  if (!token) return { ok: false, message: "Docker Hub login failed" };
  return { ok: true, message: "Docker Hub connected" };
}
