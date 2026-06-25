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
      headers: { ...GITHUB_HEADERS, ...init?.headers },
      next: init?.revalidate ? { revalidate: init.revalidate } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
