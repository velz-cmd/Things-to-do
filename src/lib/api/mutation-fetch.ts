/**
 * User-action mutations — aligned with Vercel `maxDuration` (typically 60s).
 * Big apps don't abort at 8s while the server is still working; the UI stays in-progress.
 */
export const MUTATION_FETCH_TIMEOUT_MS = 55_000;

export async function mutationFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MUTATION_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      credentials: init?.credentials ?? "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Parse JSON from a mutation response or throw with server error text. */
export async function mutationJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && data.error
        ? String(data.error)
        : `Request failed (${res.status})`,
    );
  }
  return data;
}
