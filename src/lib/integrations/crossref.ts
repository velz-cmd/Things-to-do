/** Crossref — free public metadata API (no key required). */

export type CrossrefWork = {
  title: string;
  doi?: string;
  url: string;
  published?: string;
  citations?: number;
};

const USER_AGENT = "RESOLVE/1.0 (https://resolve-self.vercel.app; mailto:resolve@arc.network)";

export async function searchCrossref(query: string, rows = 5): Promise<CrossrefWork[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];

  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", q);
  url.searchParams.set("rows", String(Math.min(rows, 20)));
  url.searchParams.set("select", "DOI,title,published,URL,is-referenced-by-count");

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
          published?: { "date-parts"?: number[][] };
          "is-referenced-by-count"?: number;
        }>;
      };
    };

    return (json.message?.items ?? [])
      .filter((i) => i.title?.[0])
      .map((i) => ({
        title: i.title![0],
        doi: i.DOI,
        url: i.URL ?? (i.DOI ? `https://doi.org/${i.DOI}` : "https://crossref.org"),
        published: i.published?.["date-parts"]?.[0]?.join("-"),
        citations: i["is-referenced-by-count"],
      }));
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
