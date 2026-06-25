import { env, INTEGRATIONS } from "@/lib/integrations/config";

export type OpenAlexWork = {
  id: string;
  title: string;
  cited_by_count: number;
  publication_year?: number;
};

export type OpenAlexRepoSignal = {
  workCount: number;
  totalCitations: number;
  topWorks: OpenAlexWork[];
  isResearchRepo: boolean;
};

function openAlexHeaders(): HeadersInit {
  const key = env("OPENALEX_API_KEY");
  return {
    Accept: "application/json",
    "User-Agent": "RESOLVE/1.0 (mailto:resolve@arc.network)",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

function openAlexUrl(path: string, params: Record<string, string>): string {
  const key = env("OPENALEX_API_KEY");
  const qs = new URLSearchParams(params);
  if (key) qs.set("api_key", key);
  return `https://api.openalex.org${path}?${qs}`;
}

/** Research impact — only for repos with academic citations (OpenAlex). */
export async function fetchRepoResearchSignal(
  owner: string,
  repo: string,
): Promise<OpenAlexRepoSignal | null> {
  if (!INTEGRATIONS.openAlex()) return null;

  const repoUrl = `https://github.com/${owner}/${repo}`;
  const url = openAlexUrl("/works", {
    search: `${owner}/${repo}`,
    per_page: "10",
    sort: "cited_by_count:desc",
  });

  try {
    const res = await fetch(url, { headers: openAlexHeaders(), next: { revalidate: 86400 } });
    if (!res.ok) {
      console.warn(`[openalex] HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        title: string;
        cited_by_count: number;
        publication_year?: number;
        primary_location?: { landing_page_url?: string };
      }>;
    };

    const results = (json.results ?? []).filter(
      (w) =>
        w.primary_location?.landing_page_url?.includes(repoUrl) ||
        w.title?.toLowerCase().includes(repo.toLowerCase()),
    );

    if (!results.length) {
      return { workCount: 0, totalCitations: 0, topWorks: [], isResearchRepo: false };
    }

    const topWorks = results.slice(0, 5).map((w) => ({
      id: w.id,
      title: w.title,
      cited_by_count: w.cited_by_count ?? 0,
      publication_year: w.publication_year,
    }));
    const totalCitations = topWorks.reduce((s, w) => s + w.cited_by_count, 0);

    return {
      workCount: results.length,
      totalCitations,
      topWorks,
      isResearchRepo: totalCitations >= 5 || results.length >= 2,
    };
  } catch (e) {
    console.warn("[openalex] fetch failed:", e);
    return null;
  }
}

export async function pingOpenAlex(): Promise<{ ok: boolean; message: string }> {
  if (!INTEGRATIONS.openAlex()) {
    return { ok: false, message: "OPENALEX_API_KEY not set" };
  }
  try {
    const res = await fetch(openAlexUrl("/works", { per_page: "1" }), {
      headers: openAlexHeaders(),
    });
    if (!res.ok) return { ok: false, message: `OpenAlex HTTP ${res.status}` };
    return { ok: true, message: "OpenAlex connected" };
  } catch {
    return { ok: false, message: "OpenAlex unreachable" };
  }
}
