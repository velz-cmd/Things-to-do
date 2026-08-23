import { env, INTEGRATIONS } from "@/lib/integrations/config";
import { classifyFetchOutcome, type ProviderFetchResult } from "@/lib/discover/research/provider-result";

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

export type OpenAlexAuthor = {
  displayName: string;
  openAlexAuthorId?: string;
};

export type OpenAlexSearchResult = {
  openAlexId: string;
  title: string;
  doi?: string;
  publicationYear?: number;
  citedByCount: number;
  /** Kept for backward compatibility - display names only. */
  authorNames: string[];
  authors: OpenAlexAuthor[];
  landingPageUrl?: string;
  sourceDisplayName?: string;
  /** Bounded sample of OpenAlex work IDs this work cites (its own references). */
  referencedWorkIds: string[];
};

export type OpenAlexCitingWork = {
  openAlexId: string;
  title: string;
  publicationYear?: number;
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
/** Structured version - honestly distinguishes zero results from failure. */
export async function searchOpenAlexWorksDetailed(
  query: string,
  perPage = 10,
): Promise<ProviderFetchResult<OpenAlexSearchResult>> {
  const attemptedAt = new Date().toISOString();
  const q = query.trim().slice(0, 200);
  if (!q) return { status: "ok", records: [], attemptedAt, completedAt: attemptedAt };

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
    const outcome = classifyFetchOutcome({ response: res });
    const completedAt = new Date().toISOString();
    if (outcome.status !== "ok") {
      return { ...outcome, records: [], attemptedAt, completedAt };
    }

    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        title?: string;
        doi?: string;
        publication_year?: number;
        cited_by_count?: number;
        authorships?: Array<{ author?: { id?: string; display_name?: string } }>;
        primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
        referenced_works?: string[];
      }>;
    };

    const records = (json.results ?? [])
      .filter((w) => w.title)
      .map((w) => {
        const authors: OpenAlexAuthor[] = (w.authorships ?? [])
          .filter((a) => Boolean(a.author?.display_name))
          .map((a) => ({
            displayName: a.author!.display_name!,
            openAlexAuthorId: a.author?.id,
          }));
        return {
          openAlexId: w.id,
          title: w.title!,
          doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : undefined,
          publicationYear: w.publication_year,
          citedByCount: w.cited_by_count ?? 0,
          authorNames: authors.map((a) => a.displayName),
          authors,
          landingPageUrl: w.primary_location?.landing_page_url,
          sourceDisplayName: w.primary_location?.source?.display_name,
          referencedWorkIds: (w.referenced_works ?? []).slice(0, 25),
        };
      });
    return { status: "ok", records, attemptedAt, completedAt };
  } catch {
    const completedAt = new Date().toISOString();
    return {
      ...classifyFetchOutcome({ threwTimeoutOrNetworkError: true }),
      records: [],
      attemptedAt,
      completedAt,
    };
  }
}

export async function searchOpenAlexWorks(
  query: string,
  perPage = 10,
): Promise<OpenAlexSearchResult[]> {
  const result = await searchOpenAlexWorksDetailed(query, perPage);
  return result.records;
}

/**
 * Bounded sample of works that cite a given OpenAlex work - the real
 * scholarly relationship graph (`cites:` filter), not an inference from
 * title similarity. Shares the exact same fetch pattern already proven in
 * src/lib/sensors/openalex-citations.ts, kept as a separate function here
 * deliberately - that Mission sensor computes its own policy-driven
 * confidence/amount-hint values and must not be touched or repointed by
 * Discover's research domain.
 */
export async function fetchCitingWorksForOpenAlexId(
  openAlexId: string,
  limit = 5,
): Promise<OpenAlexCitingWork[]> {
  const shortId = openAlexId.replace(/^https?:\/\/openalex\.org\//i, "");
  if (!shortId) return [];

  const url = openAlexUrl("/works", {
    filter: `cites:${shortId}`,
    per_page: String(Math.min(limit, 25)),
    sort: "publication_date:desc",
  });

  try {
    const res = await fetch(url, {
      headers: openAlexHeaders(),
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{ id: string; title?: string; publication_year?: number }>;
    };
    return (json.results ?? [])
      .filter((w) => w.title)
      .map((w) => ({
        openAlexId: w.id,
        title: w.title!,
        publicationYear: w.publication_year,
      }));
  } catch (e) {
    console.warn("[openalex] citing-works fetch failed:", e);
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
