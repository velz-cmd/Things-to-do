import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchArxivWorks, searchArxivWorksDetailed } from "@/lib/integrations/arxiv";

function atomEntry(overrides: {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  doi?: string;
  categories?: string[];
  authors?: string[];
}): string {
  const {
    id = "http://arxiv.org/abs/2301.00001v1",
    title = "A Paper",
    summary = "An abstract.",
    published = "2023-01-01T00:00:00Z",
    updated,
    doi,
    categories = ["cs.LG"],
    authors = ["Jane Smith"],
  } = overrides;
  return `<entry>
    <id>${id}</id>
    <title>${title}</title>
    <summary>${summary}</summary>
    <published>${published}</published>
    ${updated ? `<updated>${updated}</updated>` : ""}
    ${doi ? `<arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">${doi}</arxiv:doi>` : ""}
    ${categories.map((c) => `<category term="${c}"/>`).join("\n")}
    ${authors.map((a) => `<author><name>${a}</name></author>`).join("\n")}
    <link href="http://arxiv.org/pdf/2301.00001v1.pdf" type="application/pdf"/>
  </entry>`;
}

function feed(entries: string[]): string {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries.join("")}</feed>`;
}

describe("searchArxivWorks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns an empty list for an empty query", async () => {
    expect(await searchArxivWorks("  ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses canonical arXiv ID separately from observed version", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => feed([atomEntry({ id: "http://arxiv.org/abs/2301.00001v3" })]),
    } as Response);
    const [work] = await searchArxivWorks("test");
    expect(work.arxivId).toBe("2301.00001");
    expect(work.version).toBe("v3");
  });

  it("parses a real DOI when arXiv declares one", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => feed([atomEntry({ doi: "10.1234/example" })]),
    } as Response);
    const [work] = await searchArxivWorks("test");
    expect(work.doi).toBe("10.1234/example");
  });

  it("leaves DOI undefined rather than fabricating one when arXiv declares none", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => feed([atomEntry({})]),
    } as Response);
    const [work] = await searchArxivWorks("test");
    expect(work.doi).toBeUndefined();
  });

  it("preserves real categories and both timestamps", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        feed([atomEntry({ categories: ["cs.LG", "cs.AI"], updated: "2023-02-01T00:00:00Z" })]),
    } as Response);
    const [work] = await searchArxivWorks("test");
    expect(work.categories).toEqual(["cs.LG", "cs.AI"]);
    expect(work.publishedAt).toBe("2023-01-01T00:00:00Z");
    expect(work.updatedAt).toBe("2023-02-01T00:00:00Z");
  });

  it("skips an entry missing a required published date rather than fabricating one", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => feed([atomEntry({ published: "" })]),
    } as Response);
    expect(await searchArxivWorks("test")).toEqual([]);
  });

  it("returns an empty list on provider failure", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    expect(await searchArxivWorks("test")).toEqual([]);
  });

  it("never throws on malformed XML", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, text: async () => "{{{ not xml ]][[" } as Response);
    await expect(searchArxivWorks("test")).resolves.toEqual([]);
  });
});

describe("searchArxivWorksDetailed - honest status (Phase 3 item A2)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("distinguishes a successful zero-result response from a failure", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, text: async () => feed([]) } as Response);
    const result = await searchArxivWorksDetailed("test");
    expect(result.status).toBe("ok");
    expect(result.records).toEqual([]);
  });

  it("reports rate_limited on HTTP 429", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    const result = await searchArxivWorksDetailed("test");
    expect(result.status).toBe("rate_limited");
  });

  it("reports unavailable on a thrown timeout", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("timeout"));
    const result = await searchArxivWorksDetailed("test");
    expect(result.status).toBe("unavailable");
  });
});
