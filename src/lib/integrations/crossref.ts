/** Crossref — free public metadata API (no key required). */

export type DatePrecision = "day" | "month" | "year";

export type CrossrefAuthor = {
  givenName?: string;
  familyName: string;
  orcid?: string;
};

export type CrossrefWork = {
  title: string;
  doi?: string;
  url: string;
  /** Kept for backward compatibility - the ISO-ish string form when a full date exists. */
  published?: string;
  publicationYear?: number;
  datePrecision?: DatePrecision;
  citations?: number;
  authors: CrossrefAuthor[];
  containerTitle?: string;
  workType?: string;
};

const USER_AGENT = "RESOLVE/1.0 (https://resolve-self.vercel.app; mailto:resolve@arc.network)";

type CrossrefDateParts = { "date-parts"?: number[][] };

function parseDate(parts?: CrossrefDateParts): {
  published?: string;
  publicationYear?: number;
  datePrecision?: DatePrecision;
} {
  const dateParts = parts?.["date-parts"]?.[0];
  if (!dateParts || !dateParts.length) return {};
  const [year, month, day] = dateParts;
  if (!year) return {};
  if (day && month) {
    return {
      published: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      publicationYear: year,
      datePrecision: "day",
    };
  }
  if (month) {
    return {
      published: `${year}-${String(month).padStart(2, "0")}`,
      publicationYear: year,
      datePrecision: "month",
    };
  }
  // Year-only precision must never be silently upgraded to a fabricated
  // January 1st date - callers needing a sortable/displayable date use
  // publicationYear directly and datePrecision to know how coarse it is.
  return { publicationYear: year, datePrecision: "year" };
}

function parseAuthors(
  raw?: Array<{ given?: string; family?: string; ORCID?: string }>,
): CrossrefAuthor[] {
  return (raw ?? [])
    .filter((a) => a.family)
    .map((a) => ({
      givenName: a.given,
      familyName: a.family!,
      orcid: a.ORCID?.replace(/^https?:\/\/orcid\.org\//i, ""),
    }));
}

export async function searchCrossref(query: string, rows = 5): Promise<CrossrefWork[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];

  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", q);
  url.searchParams.set("rows", String(Math.min(rows, 20)));
  url.searchParams.set(
    "select",
    "DOI,title,published,URL,is-referenced-by-count,author,container-title,type",
  );

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          URL?: string;
          published?: CrossrefDateParts;
          "is-referenced-by-count"?: number;
          author?: Array<{ given?: string; family?: string; ORCID?: string }>;
          "container-title"?: string[];
          type?: string;
        }>;
      };
    };

    return (json.message?.items ?? [])
      .filter((i) => i.title?.[0])
      .map((i) => {
        const date = parseDate(i.published);
        return {
          title: i.title![0],
          doi: i.DOI,
          url: i.URL ?? (i.DOI ? `https://doi.org/${i.DOI}` : "https://crossref.org"),
          ...date,
          citations: i["is-referenced-by-count"],
          authors: parseAuthors(i.author),
          containerTitle: i["container-title"]?.[0],
          workType: i.type,
        };
      });
  } catch {
    return [];
  }
}

export async function pingCrossref(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://api.crossref.org/works?rows=1", {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, message: `Crossref HTTP ${res.status}` };
    return { ok: true, message: "Crossref public API connected" };
  } catch {
    return { ok: false, message: "Crossref unreachable" };
  }
}
