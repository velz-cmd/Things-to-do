import { unifiedSearch } from "./providers";
import type { SearchIntent, SearchIntelligenceResponse } from "./types";

export async function searchRepositories(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "github", maxResults);
}

export async function searchMaintainers(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "maintainers", maxResults);
}

export async function searchFundingPages(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "funding", maxResults);
}

export async function searchGithubIssues(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "issues", maxResults);
}

export async function searchDocumentation(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "docs", maxResults);
}

export async function searchPaymentIntegrations(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  return runIntent(query, "payments", maxResults);
}

export async function searchEcosystemProjects(
  query: string,
  maxResults = 10,
): Promise<SearchIntelligenceResponse> {
  const res = await unifiedSearch(query, {
    intent: "general",
    maxResults,
    includeDomains: undefined,
  });
  return {
    query,
    intent: "general",
    results: res.results,
    meta: {
      provider: res.provider,
      latencyMs: res.latencyMs,
      cached: res.cached,
      fallbacksUsed: res.fallbacksUsed,
      providerLatencies: res.providerLatencies,
    },
  };
}

async function runIntent(
  query: string,
  intent: SearchIntent,
  maxResults: number,
): Promise<SearchIntelligenceResponse> {
  const res = await unifiedSearch(query, { intent, maxResults });
  return {
    query,
    intent,
    results: res.results,
    meta: {
      provider: res.provider,
      latencyMs: res.latencyMs,
      cached: res.cached,
      fallbacksUsed: res.fallbacksUsed,
      providerLatencies: res.providerLatencies,
    },
  };
}
