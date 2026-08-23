/** arXiv Atom API — free, no key, 3s polite delay between calls. */

import { classifyFetchOutcome, type ProviderFetchResult } from "@/lib/discover/research/provider-result";

export type ArxivPaper = {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  url: string;
  pdfUrl?: string;
};

/** Richer record for Discover's research domain - preserves version/DOI/categories real arXiv exposes. */
export type ArxivWork = {
  /** Canonical (version-stripped) arXiv ID - see normalizeArxivId. */
  arxivId: string;
  /** The exact version this specific record was observed at, e.g. "v3". Undefined if arXiv gave no version suffix. */
  version?: string;
  title: string;
  authors: string[];
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  /** arXiv-declared DOI when the paper has one (arxiv:doi element) - a strong identity bridge to Crossref/OpenAlex. */
  doi?: string;
  categories: string[];
  url: string;
  pdfUrl?: string;
};

const USER_AGENT = "RESOLVE/1.0 (https://resolve-self.vercel.app)";

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function splitIdAndVersion(idRaw: string): { id: string; version?: string } {
  const bare = idRaw.split("/abs/").pop() ?? idRaw;
  const match = /^(.*?)(v\d+)$/.exec(bare);
  return match ? { id: match[1], version: match[2] } : { id: bare };
}

function parseArxivAtom(xml: string): ArxivPaper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((entry) => {
    const idRaw = entry.match(/<id>([^<]+)<\/id>/)?.[1] ?? "";
    const { id } = splitIdAndVersion(idRaw);
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled");
    const summary = decodeXml(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").slice(
      0,
      280,
    );
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "";
    const authors =
      [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]!).slice(0, 4);
    const pdfUrl = entry.match(/href="([^"]+\.pdf)"/)?.[1];
    return {
      id,
      title,
      authors,
      summary,
      published,
      url: `https://arxiv.org/abs/${id}`,
      pdfUrl,
    };
  });
}

/**
 * Parses the full Atom entry including version, DOI, categories, and the
 * updated timestamp - the richer shape Discover's research domain needs.
 * Malformed entries (missing id/title) are skipped rather than producing
 * a partially-fabricated record.
 */
function parseArxivAtomWorks(xml: string): ArxivWork[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const works: ArxivWork[] = [];
  for (const entry of entries) {
    const idRaw = entry.match(/<id>([^<]+)<\/id>/)?.[1];
    const titleRaw = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    if (!idRaw || !titleRaw) continue;
    const { id, version } = splitIdAndVersion(idRaw);
    const title = decodeXml(titleRaw);
    const summary = decodeXml(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").slice(
      0,
      600,
    );
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "";
    if (!published) continue;
    const updatedAt = entry.match(/<updated>([^<]+)<\/updated>/)?.[1];
    const doi = entry.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/)?.[1];
    const categories = [...entry.matchAll(/<category term="([^"]+)"/g)].map((m) => m[1]!);
    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]!).slice(0, 10);
    const pdfUrl = entry.match(/href="([^"]+\.pdf)"/)?.[1];

    works.push({
      arxivId: id,
      version,
      title,
      authors,
      summary,
      publishedAt: published,
      updatedAt,
      doi,
      categories,
      url: `https://arxiv.org/abs/${idRaw.includes("v") ? idRaw.split("/abs/").pop() : id}`,
      pdfUrl,
    });
  }
  return works;
}

function buildArxivQuery(communityName?: string, question?: string): string {
  const scope = communityName?.trim() ?? "";
  const q = question?.trim() ?? "";
  const terms = [scope, q]
    .join(" ")
    .replace(/[^\w\s.-]/g, " ")
    .trim()
    .slice(0, 120);
  if (!terms) return "all:open source";
  if (/climate|research|science|ai|machine learning/i.test(terms)) {
    return `all:${terms.split(/\s+/).slice(0, 4).join(" ")}`;
  }
  return `all:${terms.split(/\s+/).slice(0, 3).join(" ")}`;
}

export async function searchArxiv(input: {
  communityName?: string;
  question?: string;
  maxResults?: number;
}): Promise<ArxivPaper[]> {
  const max = Math.min(input.maxResults ?? 5, 10);
  const searchQuery = buildArxivQuery(input.communityName, input.question);

  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(max));
  url.searchParams.set("sortBy", "relevance");
  url.searchParams.set("sortOrder", "descending");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseArxivAtom(xml);
  } catch {
    return [];
  }
}

/**
 * Deterministic-query arXiv search for Discover's shared research market.
 * The query is caller-supplied configuration (see OPEN_RESEARCH_QUERIES /
 * research-target registry) - never AI-generated. Distinct from
 * searchArxiv() above, which builds its own query from Mission
 * community/question context; that function's behavior is unchanged.
 */
/** Structured version - honestly distinguishes zero results from failure. */
export async function searchArxivWorksDetailed(
  query: string,
  maxResults = 5,
): Promise<ProviderFetchResult<ArxivWork>> {
  const attemptedAt = new Date().toISOString();
  const q = query.trim().slice(0, 200);
  if (!q) return { status: "ok", records: [], attemptedAt, completedAt: attemptedAt };
  const max = Math.min(maxResults, 20);

  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `all:${q}`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(max));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    const outcome = classifyFetchOutcome({ response: res });
    const completedAt = new Date().toISOString();
    if (outcome.status !== "ok") {
      return { ...outcome, records: [], attemptedAt, completedAt };
    }
    const xml = await res.text();
    return { status: "ok", records: parseArxivAtomWorks(xml), attemptedAt, completedAt };
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

export async function searchArxivWorks(query: string, maxResults = 5): Promise<ArxivWork[]> {
  const result = await searchArxivWorksDetailed(query, maxResults);
  return result.records;
}

export async function pingArxiv(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(
      "https://export.arxiv.org/api/query?search_query=all:electron&max_results=1",
      { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return { ok: false, message: `arXiv HTTP ${res.status}` };
    return { ok: true, message: "arXiv Atom API connected" };
  } catch {
    return { ok: false, message: "arXiv unreachable" };
  }
}
