import type { SearchOptions, UnifiedSearchResponse } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  value: UnifiedSearchResponse;
};

const cache = new Map<string, CacheEntry>();

function stableKey(query: string, options?: SearchOptions): string {
  return JSON.stringify({
    q: query.trim().toLowerCase(),
    max: options?.maxResults ?? 10,
    intent: options?.intent ?? "general",
    domains: options?.includeDomains?.sort() ?? [],
  });
}

export function getCachedSearch(
  query: string,
  options?: SearchOptions,
): UnifiedSearchResponse | null {
  const key = stableKey(query, options);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value, cached: true };
}

export function setCachedSearch(
  query: string,
  options: SearchOptions | undefined,
  value: UnifiedSearchResponse,
): void {
  const key = stableKey(query, options);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function clearSearchCache(): void {
  cache.clear();
}
