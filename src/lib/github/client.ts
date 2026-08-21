export const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RESOLVE-Capital-Flow-Protocol",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

export function hasGithubToken(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}

export async function githubFetch<T>(
  url: string,
  init?: RequestInit & { revalidate?: number },
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(8_000),
      headers: { ...GITHUB_HEADERS, ...init?.headers },
      next: init?.revalidate ? { revalidate: init.revalidate } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Raised by githubFetchOrThrow for any non-404 upstream failure - a bad/expired
 * GITHUB_TOKEN, rate limiting, or a GitHub outage - so callers that need to
 * tell "repository does not exist" apart from "GitHub is unreachable right
 * now" don't have to guess from a bare `null`. */
export class GithubUpstreamError extends Error {
  constructor(public status: number) {
    super(`GitHub API request failed with status ${status}`);
  }
}

/**
 * Same as githubFetch, but a genuine 404 is the only failure that resolves
 * to `null`. Every other non-ok response (401 bad token, 403 rate limit,
 * 5xx) throws GithubUpstreamError instead of being silently swallowed as
 * "not found" - callers deciding whether to tell a user "this repository
 * doesn't exist" must not conflate that with "GitHub rejected our request."
 */
export async function githubFetchOrThrow<T>(
  url: string,
  init?: RequestInit & { revalidate?: number },
): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(8_000),
    headers: { ...GITHUB_HEADERS, ...init?.headers },
    next: init?.revalidate ? { revalidate: init.revalidate } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubUpstreamError(res.status);
  return (await res.json()) as T;
}
