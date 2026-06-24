import type { SearchOptions, SearchResult } from "./types";
import { fetchWithRetry, intentDomains } from "./utils";

export function isTavilyConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export async function searchTavily(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const includeDomains = options?.includeDomains ?? intentDomains(options?.intent);
  const body: Record<string, unknown> = {
    query,
    search_depth: "basic",
    max_results: Math.min(options?.maxResults ?? 10, 20),
    include_answer: false,
  };
  if (includeDomains?.length) body.include_domains = includeDomains;

  const res = await fetchWithRetry(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    "tavily",
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string; score?: number }[];
  };

  return (data.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      snippet: (r.content ?? "").slice(0, 500),
      source: "tavily" as const,
      score: r.score,
    }));
}
