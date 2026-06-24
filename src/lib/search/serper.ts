import type { SearchOptions, SearchResult } from "./types";
import { fetchWithRetry } from "./utils";

export function isSerperConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY?.trim());
}

export async function searchSerper(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");

  const res = await fetchWithRetry(
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(options?.maxResults ?? 10, 20),
      }),
    },
    "serper",
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    organic?: { title?: string; link?: string; snippet?: string; position?: number }[];
  };

  return (data.organic ?? [])
    .filter((r) => r.link && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.link!,
      snippet: r.snippet ?? "",
      source: "serper" as const,
      score: r.position != null ? 1 / (r.position + 1) : undefined,
    }));
}
