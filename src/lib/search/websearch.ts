import type { SearchOptions, SearchResult } from "./types";
import { fetchWithRetry } from "./utils";

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.WEBSEARCH_API_KEY?.trim());
}

function getWebSearchEndpoint(): string {
  return (
    process.env.WEBSEARCH_API_URL?.trim() ||
    "https://api.websearchapi.ai/ai-search"
  );
}

export async function searchWebSearchApi(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const apiKey = process.env.WEBSEARCH_API_KEY?.trim();
  if (!apiKey) throw new Error("WEBSEARCH_API_KEY not configured");

  const includeDomains = options?.includeDomains;
  const body: Record<string, unknown> = {
    query,
    maxResults: Math.min(options?.maxResults ?? 10, 20),
    includeContent: false,
    country: "us",
    language: "en",
    safeSearch: true,
  };
  if (includeDomains?.length) body.includeDomains = includeDomains;

  const res = await fetchWithRetry(
    getWebSearchEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    "websearch",
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WebSearch HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: {
      title?: string;
      url?: string;
      snippet?: string;
      description?: string;
      content?: string;
      position?: number;
    }[];
    data?: { title?: string; url?: string; snippet?: string }[];
  };

  const rows = (data.results ?? data.data ?? []) as {
    title?: string;
    url?: string;
    snippet?: string;
    description?: string;
    content?: string;
    position?: number;
  }[];
  return rows
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      snippet: (r.snippet ?? r.description ?? r.content ?? "").slice(0, 500),
      source: "websearch" as const,
      score: r.position != null ? 1 / (r.position + 1) : undefined,
    }));
}
