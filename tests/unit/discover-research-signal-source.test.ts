import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/crossref", () => ({
  searchCrossref: vi.fn(),
  pingCrossref: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));
vi.mock("@/lib/integrations/openalex", () => ({
  searchOpenAlexWorks: vi.fn(),
  fetchCitingWorksForOpenAlexId: vi.fn().mockResolvedValue([]),
  pingOpenAlex: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));
vi.mock("@/lib/integrations/arxiv", () => ({
  searchArxivWorks: vi.fn().mockResolvedValue([]),
  pingArxiv: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));

import { searchCrossref } from "@/lib/integrations/crossref";
import { searchOpenAlexWorks, fetchCitingWorksForOpenAlexId } from "@/lib/integrations/openalex";
import { searchArxivWorks } from "@/lib/integrations/arxiv";
import { loadResearchSignals } from "@/lib/discover/marketplace/research-signal-source";
import { OPEN_RESEARCH_QUERIES } from "@/lib/sensors/targets";

const mockedCrossref = vi.mocked(searchCrossref);
const mockedOpenAlex = vi.mocked(searchOpenAlexWorks);
const mockedArxiv = vi.mocked(searchArxivWorks);
const mockedCitingWorks = vi.mocked(fetchCitingWorksForOpenAlexId);

describe("loadResearchSignals", () => {
  beforeEach(() => {
    mockedCrossref.mockReset().mockResolvedValue([]);
    mockedOpenAlex.mockReset().mockResolvedValue([]);
    mockedArxiv.mockReset().mockResolvedValue([]);
    mockedCitingWorks.mockReset().mockResolvedValue([]);
  });

  it("calls Crossref/OpenAlex/arXiv once per configured research target, never one hardcoded query", async () => {
    await loadResearchSignals();
    expect(mockedCrossref).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
    expect(mockedOpenAlex).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
    expect(mockedArxiv).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
  });

  it("returns an empty list when every connector returns nothing", async () => {
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("returns an empty list when every connector throws", async () => {
    mockedCrossref.mockRejectedValue(new Error("network down"));
    mockedOpenAlex.mockRejectedValue(new Error("network down"));
    mockedArxiv.mockRejectedValue(new Error("network down"));
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("maps a real Crossref work into a research_outcome verified_work item with citation impact, never funding", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              title: "Sustaining Open Source Software",
              doi: "10.1234/abc.567",
              url: "https://doi.org/10.1234/abc.567",
              published: "2023-04-01",
              publicationYear: 2023,
              datePrecision: "day" as const,
              citations: 42,
              authors: [{ givenName: "Ada", familyName: "Lovelace" }],
            },
          ]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:doi:10.1234/abc.567");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.type).toBe("research_outcome");
    expect(item.funding).toBeUndefined();
    expect(item.creator.name).toBe("Ada Lovelace");
    expect(item.impactProfile).toEqual({
      measurable: true,
      signals: [
        expect.objectContaining({ id: "crossref_citations", value: "42", scope: "artifact", source: "Crossref" }),
      ],
    });
  });

  it("marks impact not measurable when no connector reported a citation count", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [{ title: "Brand new preprint", doi: "10.1234/new.001", url: "https://doi.org/10.1234/new.001", authors: [] }]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.impactProfile).toEqual({
      measurable: false,
      reason: expect.stringContaining("citation count"),
    });
  });

  it("merges a Crossref and OpenAlex record of the same DOI into one item, preserving both citation observations separately", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              title: "Sustaining Open Source Software",
              doi: "10.1234/abc.567",
              url: "https://doi.org/10.1234/abc.567",
              citations: 42,
              authors: [],
            },
          ]
        : [],
    );
    mockedOpenAlex.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              openAlexId: "https://openalex.org/W123",
              title: "Sustaining Open Source Software",
              doi: "https://doi.org/10.1234/abc.567",
              citedByCount: 45,
              authorNames: ["Ada Lovelace"],
              authors: [{ displayName: "Ada Lovelace" }],
              landingPageUrl: "https://example.com/paper",
              referencedWorkIds: [],
            },
          ]
        : [],
    );
    const items = await loadResearchSignals();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("research:doi:10.1234/abc.567");
    expect(items[0].impactProfile?.measurable).toBe(true);
    if (items[0].impactProfile?.measurable) {
      const ids = items[0].impactProfile.signals.map((s) => s.id).sort();
      expect(ids).toEqual(["crossref_citations", "openalex_citations"]);
    }
  });

  it("keeps an OpenAlex-only work with no DOI, keyed by its OpenAlex ID", async () => {
    mockedOpenAlex.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              openAlexId: "https://openalex.org/W999",
              title: "A DOI-less preprint",
              citedByCount: 3,
              authorNames: [],
              authors: [],
              referencedWorkIds: [],
            },
          ]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:openalex:W999");
  });

  it("includes real arXiv works in the shared market, distinct from the PR/issue title heuristic", async () => {
    mockedArxiv.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              arxivId: "2301.00001",
              title: "A preprint",
              authors: ["Jane Smith"],
              summary: "",
              publishedAt: "2023-01-01T00:00:00Z",
              categories: [],
              url: "https://arxiv.org/abs/2301.00001",
            },
          ]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:arxiv:2301.00001");
    expect(item.creator.name).toBe("Jane Smith");
  });

  it("shows a real et-al author display for multi-author works", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [
            {
              title: "A paper",
              doi: "10.1/a",
              url: "https://doi.org/10.1/a",
              authors: [
                { givenName: "Jane", familyName: "Smith" },
                { givenName: "John", familyName: "Doe" },
              ],
            },
          ]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.creator.name).toBe("Jane Smith et al.");
  });

  it("never claims funding demand from citation impact alone", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? [{ title: "Highly cited", doi: "10.1/highcite", url: "https://doi.org/10.1/highcite", citations: 10000, authors: [] }]
        : [],
    );
    const [item] = await loadResearchSignals();
    expect(item.funding).toBeUndefined();
    expect(item.economicMatch).toBeUndefined();
  });

  it("bounds citing-work lookups rather than firing one extra request per row", async () => {
    mockedOpenAlex.mockImplementation(async (query: string) =>
      query === OPEN_RESEARCH_QUERIES[0]
        ? Array.from({ length: 8 }, (_, i) => ({
            openAlexId: `https://openalex.org/W${i}`,
            title: `Work ${i}`,
            citedByCount: 1,
            authorNames: [],
            authors: [],
            referencedWorkIds: [],
          }))
        : [],
    );
    await loadResearchSignals();
    expect(mockedCitingWorks.mock.calls.length).toBeLessThanOrEqual(5);
  });
});
