/** arXiv Atom API — free, no key, 3s polite delay between calls. */

export type ArxivPaper = {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
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

function parseArxivAtom(xml: string): ArxivPaper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((entry) => {
    const idRaw = entry.match(/<id>([^<]+)<\/id>/)?.[1] ?? "";
    const id = idRaw.split("/abs/").pop() ?? idRaw;
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
