export type SearchProviderId = "tavily" | "serper" | "websearch";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: SearchProviderId;
  score?: number;
};

export type SearchIntent =
  | "general"
  | "github"
  | "maintainers"
  | "funding"
  | "docs"
  | "payments"
  | "issues";

export type SearchOptions = {
  maxResults?: number;
  intent?: SearchIntent;
  includeDomains?: string[];
};

export type UnifiedSearchResponse = {
  query: string;
  results: SearchResult[];
  provider: SearchProviderId;
  latencyMs: number;
  cached: boolean;
  fallbacksUsed: SearchProviderId[];
  providerLatencies: Partial<Record<SearchProviderId, number>>;
};

export type SearchIntelligenceResponse = {
  query: string;
  intent: SearchIntent;
  results: SearchResult[];
  meta: Omit<UnifiedSearchResponse, "query" | "results">;
};
