import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/crossref", () => ({
  searchCrossref: vi.fn(),
  pingCrossref: vi.fn(),
}));
vi.mock("@/lib/integrations/openalex", () => ({
  searchOpenAlexWorks: vi.fn(),
}));

import { searchCrossref } from "@/lib/integrations/crossref";
import { searchOpenAlexWorks } from "@/lib/integrations/openalex";
import { loadResearchSignals } from "@/lib/discover/marketplace/research-signal-source";

const mockedCrossref = vi.mocked(searchCrossref);
const mockedOpenAlex = vi.mocked(searchOpenAlexWorks);

describe("loadResearchSignals", () => {
  it("returns an empty list when both connectors return nothing", async () => {
    mockedCrossref.mockResolvedValueOnce([]);
    mockedOpenAlex.mockResolvedValueOnce([]);
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("returns an empty list when both connectors throw", async () => {
    mockedCrossref.mockRejectedValueOnce(new Error("network down"));
    mockedOpenAlex.mockRejectedValueOnce(new Error("network down"));
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("drops Crossref works without a DOI", async () => {
    mockedCrossref.mockResolvedValueOnce([
      { title: "No DOI here", url: "https://crossref.org", citations: 5 },
    ]);
    mockedOpenAlex.mockResolvedValueOnce([]);
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("maps a real Crossref work into a verified_work marketplace item with citation impact, never funding", async () => {
    mockedCrossref.mockResolvedValueOnce([
      {
        title: "Sustaining Open Source Software",
        doi: "10.1234/abc.567",
        url: "https://doi.org/10.1234/abc.567",
        published: "2023-04-01",
        citations: 42,
      },
    ]);
    mockedOpenAlex.mockResolvedValueOnce([]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:10.1234/abc.567");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.type).toBe("research_request");
    expect(item.funding).toBeUndefined();
    expect(item.impactProfile).toEqual({
      measurable: true,
      signals: [
        expect.objectContaining({
          id: "crossref_citations",
          value: "42",
          scope: "artifact",
          source: "Crossref",
        }),
      ],
    });
  });

  it("marks impact not measurable when no connector has a citation count", async () => {
    mockedCrossref.mockResolvedValueOnce([
      {
        title: "Brand new preprint",
        doi: "10.1234/new.001",
        url: "https://doi.org/10.1234/new.001",
      },
    ]);
    mockedOpenAlex.mockResolvedValueOnce([]);
    const [item] = await loadResearchSignals();
    expect(item.impactProfile).toEqual({
      measurable: false,
      reason: expect.stringContaining("citation count"),
    });
  });

  it("merges a Crossref and OpenAlex record of the same DOI into one item, not two", async () => {
    mockedCrossref.mockResolvedValueOnce([
      {
        title: "Sustaining Open Source Software",
        doi: "10.1234/abc.567",
        url: "https://doi.org/10.1234/abc.567",
        published: "2023-04-01",
        citations: 42,
      },
    ]);
    mockedOpenAlex.mockResolvedValueOnce([
      {
        openAlexId: "https://openalex.org/W123",
        title: "Sustaining Open Source Software",
        doi: "https://doi.org/10.1234/abc.567",
        citedByCount: 45,
        authorNames: ["Ada Lovelace"],
        landingPageUrl: "https://example.com/paper",
      },
    ]);
    const items = await loadResearchSignals();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("research:10.1234/abc.567");
    expect(items[0].impactProfile).toEqual({
      measurable: true,
      signals: [
        expect.objectContaining({ id: "crossref_citations", value: "42" }),
        expect.objectContaining({ id: "openalex_citations", value: "45" }),
      ],
    });
  });

  it("keeps an OpenAlex-only work with no DOI, keyed by its OpenAlex ID", async () => {
    mockedCrossref.mockResolvedValueOnce([]);
    mockedOpenAlex.mockResolvedValueOnce([
      {
        openAlexId: "https://openalex.org/W999",
        title: "A DOI-less preprint",
        citedByCount: 3,
        authorNames: [],
      },
    ]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:openalex:https://openalex.org/W999");
    expect(item.impactProfile).toEqual({
      measurable: true,
      signals: [expect.objectContaining({ id: "openalex_citations", source: "OpenAlex", value: "3" })],
    });
  });
});
