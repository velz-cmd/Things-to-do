/** Race a promise against a deadline — used to keep Discover APIs responsive on Vercel. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function discoverIntelligenceTimeoutMs(repository?: string | null): number {
  return repository?.trim() ? 12_000 : 3_500;
}
