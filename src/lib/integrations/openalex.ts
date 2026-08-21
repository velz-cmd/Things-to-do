import { env, INTEGRATIONS } from "@/lib/integrations/config";

export function openAlexPoliteUserAgent(): string {
  const email = env("OPENALEX_EMAIL") ?? env("RESOLVE_CONTACT_EMAIL") ?? "resolve@arc.network";
  return `RESOLVE/1.0 (mailto:${email})`;
}

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
    "User-Agent": openAlexPoliteUserAgent(),
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

export type OpenAlexSearchResult = {
  openAlexId: string;
  title: string;
  doi?: string;
  publicationYear?: number;
  citedByCount: number;
  authorNames: string[];
  landingPageUrl?: string;
};

/**
 * General-purpose OpenAlex work search, independent of any specific GitHub
 * repository - used to surface real author/work identity and citation
 * context as its own market-index entries (Discover's research domain).
 * Every result carries its DOI when OpenAlex has one, so a caller can
 * deduplicate against the same work observed via another connector
 * (e.g. Crossref) by DOI identity rather than risk showing the same paper
 * twice as two different "outcomes".
 */
export async function searchOpenAlexWorks(
  query: string,
  perPage = 10,
): Promise<OpenAlexSearchResult[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];

  const url = openAlexUrl("/works", {
    search: q,
    per_page: String(Math.min(perPage, 25)),
    sort: "cited_by_count:desc",
  });

  try {
    const res = await fetch(url, {
      headers: openAlexHeaders(),
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        title?: string;
        doi?: string;
        publication_year?: number;
        cited_by_count?: number;
        authorships?: Array<{ author?: { display_name?: string } }>;
        primary_location?: { landing_page_url?: string };
      }>;
    };

    return (json.results ?? [])
      .filter((w) => w.title)
      .map((w) => ({
        openAlexId: w.id,
        title: w.title!,
        doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : undefined,
        publicationYear: w.publication_year,
        citedByCount: w.cited_by_count ?? 0,
        authorNames: (w.authorships ?? [])
          .map((a) => a.author?.display_name)
          .filter((name): name is string => Boolean(name)),
        landingPageUrl: w.primary_location?.landing_page_url,
      }));
  } catch (e) {
    console.warn("[openalex] search failed:", e);
    return [];
  }
}

export async function pingOpenAlex(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(openAlexUrl("/works", { per_page: "1" }), {
      headers: openAlexHeaders(),
    });
    if (!res.ok) return { ok: false, message: `OpenAlex HTTP ${res.status}` };
    const boosted = Boolean(env("OPENALEX_API_KEY"));
    return {
      ok: true,
      message: boosted
        ? "OpenAlex connected (platform key — higher limits)"
        : "OpenAlex connected (public API — works for all users globally)",
    };
  } catch {
    return { ok: false, message: "OpenAlex unreachable" };
  }
}
