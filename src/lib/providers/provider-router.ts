type ProviderAttempt<T> = {
  name: string;
  run: () => Promise<T>;
};

type RunWithFallbackInput<T> = {
  feature: string;
  providers: ProviderAttempt<T>[];
  cacheKey?: string;
  fallback: T | (() => T | Promise<T>);
  timeoutMs?: number;
  onProviderError?: (error: unknown, providerName: string) => void;
};

export async function withProviderTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "provider",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Central provider fallback path for product surfaces.
 * Main UI gets a deterministic value; provider details stay in logs.
 */
export async function runWithFallback<T>({
  feature,
  providers,
  fallback,
  timeoutMs = 4_000,
  onProviderError,
}: RunWithFallbackInput<T>): Promise<T> {
  for (const provider of providers) {
    try {
      return await withProviderTimeout(provider.run(), timeoutMs, `${feature}:${provider.name}`);
    } catch (error) {
      onProviderError?.(error, provider.name);
      console.warn("[provider-router]", {
        feature,
        provider: provider.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (typeof fallback === "function") {
    const getFallback = fallback as () => T | Promise<T>;
    return await getFallback();
  }

  return fallback;
}
