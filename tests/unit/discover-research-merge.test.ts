import { describe, expect, it } from "vitest";
import { mergeResearchWorks } from "@/lib/discover/research/merge";
import type { CrossrefWork } from "@/lib/integrations/crossref";
import type { OpenAlexSearchResult } from "@/lib/integrations/openalex";
import type { ArxivWork } from "@/lib/integrations/arxiv";

const observedAt = "2026-08-01T00:00:00.000Z";

function crossref(overrides: Partial<CrossrefWork> = {}): CrossrefWork {
  return {
    title: "A Paper",
    doi: "10.1234/example",
    url: "https://doi.org/10.1234/example",
    authors: [],
    ...overrides,
  };
}

function openAlex(overrides: Partial<OpenAlexSearchResult> = {}): OpenAlexSearchResult {
  return {
    openAlexId: "https://openalex.org/W1",
    title: "A Paper",
    citedByCount: 0,
    authorNames: [],
    authors: [],
    referencedWorkIds: [],
    ...overrides,
  };
}

function arxiv(overrides: Partial<ArxivWork> = {}): ArxivWork {
  return {
    arxivId: "2301.00001",
    title: "A Paper",
    authors: [],
    summary: "",
    publishedAt: "2023-01-01T00:00:00Z",
    categories: [],
    url: "https://arxiv.org/abs/2301.00001",
    ...overrides,
  };
}

describe("mergeResearchWorks - canonical identity", () => {
  it("dedupes the same DOI observed by both Crossref and OpenAlex into one work", () => {
    const result = mergeResearchWorks({
      crossref: [crossref()],
      openAlex: [openAlex({ doi: "10.1234/example" })],
      arxiv: [],
      observedAt,
    });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("doi:10.1234/example");
  });

  it("normalizes DOI case and URL form before comparing identity", () => {
    const result = mergeResearchWorks({
      crossref: [crossref({ doi: "10.1234/EXAMPLE" })],
      openAlex: [openAlex({ doi: "https://doi.org/10.1234/example" })],
      arxiv: [],
      observedAt,
    });
    expect(result).toHaveLength(1);
  });

  it("collapses arXiv v1/v2/v3 of the same preprint into one canonical work", () => {
    const v1 = mergeResearchWorks({
      crossref: [],
      openAlex: [],
      arxiv: [arxiv({ arxivId: "2301.00001", version: "v1" })],
      observedAt,
    });
    const v3 = mergeResearchWorks({
      crossref: [],
      openAlex: [],
      arxiv: [arxiv({ arxivId: "2301.00001", version: "v3" })],
      observedAt,
    });
    expect(v1[0].key).toBe(v3[0].key);
    expect(v3[0].arxivVersion).toBe("v3");
  });

  it("merges an arXiv record into its DOI work when arXiv declares an authoritative DOI", () => {
    const result = mergeResearchWorks({
      crossref: [crossref({ doi: "10.1234/example" })],
      openAlex: [],
      arxiv: [arxiv({ doi: "10.1234/example" })],
      observedAt,
    });
    expect(result).toHaveLength(1);
    expect(result[0].arxivId).toBe("2301.00001");
    expect(result[0].doi).toBe("10.1234/example");
  });

  it("never merges by title alone - two different papers with similar titles stay separate", () => {
    const result = mergeResearchWorks({
      crossref: [
        crossref({ doi: "10.1/a", title: "Open source sustainability" }),
        crossref({ doi: "10.1/b", title: "Open source sustainability" }),
      ],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(result).toHaveLength(2);
  });

  it("keeps a Crossref record with no DOI out of the merged set rather than keying by title", () => {
    const result = mergeResearchWorks({
      crossref: [crossref({ doi: undefined })],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(result).toHaveLength(0);
  });

  it("keeps an OpenAlex-only work (no DOI) as its own canonical record", () => {
    const result = mergeResearchWorks({
      crossref: [],
      openAlex: [openAlex({ doi: undefined, openAlexId: "https://openalex.org/W9" })],
      arxiv: [],
      observedAt,
    });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("openalex:W9");
  });
});

describe("mergeResearchWorks - citation semantics", () => {
  it("keeps Crossref and OpenAlex citation counts as separate observations, never averaged", () => {
    const [work] = mergeResearchWorks({
      crossref: [crossref({ citations: 27 })],
      openAlex: [openAlex({ doi: "10.1234/example", citedByCount: 31 })],
      arxiv: [],
      observedAt,
    });
    expect(work.citations).toEqual([
      { source: "Crossref", count: 27, observedAt },
      { source: "OpenAlex", count: 31, observedAt },
    ]);
  });

  it("records a successful zero-citation response as a real observation, not an omission", () => {
    const [work] = mergeResearchWorks({
      crossref: [crossref({ citations: 0 })],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.citations).toEqual([{ source: "Crossref", count: 0, observedAt }]);
  });

  it("omits a citation observation entirely when the provider didn't report a count at all", () => {
    const [work] = mergeResearchWorks({
      crossref: [crossref({ citations: undefined })],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.citations).toEqual([]);
  });
});

describe("mergeResearchWorks - date precision", () => {
  it("never fabricates a day/month from a year-only Crossref date", () => {
    const [work] = mergeResearchWorks({
      crossref: [crossref({ publicationYear: 2024, datePrecision: "year", published: undefined })],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.publishedDate).toBeUndefined();
    expect(work.publicationYear).toBe(2024);
    expect(work.datePrecision).toBe("year");
  });
});

describe("mergeResearchWorks - author identity", () => {
  it("parses Crossref authors with ORCID", () => {
    const [work] = mergeResearchWorks({
      crossref: [
        crossref({
          authors: [{ givenName: "Jane", familyName: "Smith", orcid: "0000-0001-2345-6789" }],
        }),
      ],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.authors).toEqual([{ name: "Jane Smith", orcid: "0000-0001-2345-6789" }]);
  });

  it("supports multi-author display", () => {
    const [work] = mergeResearchWorks({
      crossref: [
        crossref({
          authors: [
            { givenName: "Jane", familyName: "Smith" },
            { givenName: "John", familyName: "Doe" },
          ],
        }),
      ],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.authors).toHaveLength(2);
  });

  it("produces an empty author list rather than a fabricated placeholder when none are known", () => {
    const [work] = mergeResearchWorks({
      crossref: [crossref({ authors: [] })],
      openAlex: [],
      arxiv: [],
      observedAt,
    });
    expect(work.authors).toEqual([]);
  });
});
