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

export type ProviderFallbackResult<T> = {
  value: T;
  source: "provider" | "cache" | "fallback";
  provider: string | null;
  stale: boolean;
  failures: Array<{ provider: string; message: string }>;
};

const lastKnown = new Map<string, { value: unknown; storedAt: number }>();

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
export async function runWithFallbackResult<T>({
  feature,
  providers,
  cacheKey,
  fallback,
  timeoutMs = 4_000,
  onProviderError,
}: RunWithFallbackInput<T>): Promise<ProviderFallbackResult<T>> {
  const failures: Array<{ provider: string; message: string }> = [];
  for (const provider of providers) {
    try {
      const value = await withProviderTimeout(provider.run(), timeoutMs, `${feature}:${provider.name}`);
      if (cacheKey) lastKnown.set(cacheKey, { value, storedAt: Date.now() });
      return { value, source: "provider", provider: provider.name, stale: false, failures };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ provider: provider.name, message });
      onProviderError?.(error, provider.name);
      console.warn("[provider-router]", {
        feature,
        provider: provider.name,
        message,
      });
    }
  }

  const cached = cacheKey ? lastKnown.get(cacheKey) : undefined;
  if (cached) {
    return {
      value: cached.value as T,
      source: "cache",
      provider: null,
      stale: true,
      failures,
    };
  }

  if (typeof fallback === "function") {
    const getFallback = fallback as () => T | Promise<T>;
    return { value: await getFallback(), source: "fallback", provider: null, stale: true, failures };
  }

  return { value: fallback, source: "fallback", provider: null, stale: true, failures };
}

export async function runWithFallback<T>(input: RunWithFallbackInput<T>): Promise<T> {
  const result = await runWithFallbackResult(input);
  return result.value;
}
