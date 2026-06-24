import { getCachedSearch, setCachedSearch } from "./cache";
import { searchSerper, isSerperConfigured } from "./serper";
import { searchTavily, isTavilyConfigured } from "./tavily";
import type { SearchOptions, SearchProviderId, SearchResult, UnifiedSearchResponse } from "./types";
import {
  dedupeResults,
  intentDomains,
  intentQuery,
  isRateLimited,
  rankResults,
} from "./utils";
import { searchWebSearchApi, isWebSearchConfigured } from "./websearch";

export { isTavilyConfigured, isSerperConfigured, isWebSearchConfigured };

type ProviderRunner = {
  id: SearchProviderId;
  configured: () => boolean;
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
};

const PROVIDER_CHAIN: ProviderRunner[] = [
  { id: "tavily", configured: isTavilyConfigured, search: searchTavily },
  { id: "serper", configured: isSerperConfigured, search: searchSerper },
  { id: "websearch", configured: isWebSearchConfigured, search: searchWebSearchApi },
];

export function listSearchProviders(): {
  tavily: boolean;
  serper: boolean;
  websearch: boolean;
  primary: SearchProviderId | null;
} {
  const tavily = isTavilyConfigured();
  const serper = isSerperConfigured();
  const websearch = isWebSearchConfigured();
  const primary = tavily ? "tavily" : serper ? "serper" : websearch ? "websearch" : null;
  return { tavily, serper, websearch, primary };
}

export function isSearchConfigured(): boolean {
  return PROVIDER_CHAIN.some((p) => p.configured());
}

/**
 * Unified search with automatic fallback: Tavily → Serper → WebSearch API.
 * Results are deduplicated, ranked, and cached for 5 minutes.
 */
export async function unifiedSearch(
  query: string,
  options?: SearchOptions,
): Promise<UnifiedSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Search query is required");
  }

  const cached = getCachedSearch(trimmed, options);
  if (cached) return cached;

  const enrichedOptions: SearchOptions = {
    maxResults: options?.maxResults ?? 10,
    intent: options?.intent ?? "general",
    includeDomains: options?.includeDomains ?? intentDomains(options?.intent),
  };

  const searchQuery = intentQuery(trimmed, enrichedOptions.intent);
  const fallbacksUsed: SearchProviderId[] = [];
  const providerLatencies: Partial<Record<SearchProviderId, number>> = {};
  const started = Date.now();

  let lastError: unknown;

  for (const provider of PROVIDER_CHAIN) {
    if (!provider.configured()) continue;

    const providerStart = Date.now();
    try {
      const raw = await provider.search(searchQuery, enrichedOptions);
      providerLatencies[provider.id] = Date.now() - providerStart;

      const results = rankResults(
        dedupeResults(raw),
        enrichedOptions.intent,
      ).slice(0, enrichedOptions.maxResults);

      const response: UnifiedSearchResponse = {
        query: trimmed,
        results,
        provider: provider.id,
        latencyMs: Date.now() - started,
        cached: false,
        fallbacksUsed,
        providerLatencies,
      };

      console.info(
        `[search] ${provider.id} ok ${providerLatencies[provider.id]}ms → ${results.length} results`,
      );

      setCachedSearch(trimmed, enrichedOptions, response);
      return response;
    } catch (e) {
      providerLatencies[provider.id] = Date.now() - providerStart;
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      const rateLimited = message.includes("429");
      console.warn(
        `[search] ${provider.id} failed (${rateLimited ? "rate-limit" : "error"}) ${providerLatencies[provider.id]}ms:`,
        message,
      );
      fallbacksUsed.push(provider.id);

      if (rateLimited || isRateLimitedFromError(message)) {
        continue;
      }
      continue;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No search providers configured or all providers failed");
}

function isRateLimitedFromError(message: string): boolean {
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}
