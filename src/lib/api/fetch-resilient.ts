const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * External fetch with AbortController timeout (10s default) and exponential backoff retries.
 * Returns null when all attempts fail — callers should serve cached/stale data instead.
 */
export async function fetchResilient(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, signal: parentSignal, ...rest } = init;
  const attempts = retries + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    parentSignal?.addEventListener("abort", onParentAbort);

    try {
      const response = await fetch(url, { ...rest, signal: controller.signal });
      if (response.ok || response.status < 500) {
        return response;
      }
    } catch {
      /* retry */
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onParentAbort);
    }

    if (attempt < attempts - 1) {
      await sleep(200 * 2 ** attempt);
    }
  }

  return null;
}

export { DEFAULT_TIMEOUT_MS as FETCH_TIMEOUT_MS };
