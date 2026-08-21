import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/crossref", () => ({
  searchCrossref: vi.fn(),
  pingCrossref: vi.fn(),
}));

import { searchCrossref } from "@/lib/integrations/crossref";
import { loadResearchSignals } from "@/lib/discover/marketplace/research-signal-source";

const mockedSearch = vi.mocked(searchCrossref);

describe("loadResearchSignals", () => {
  it("returns an empty list when Crossref returns nothing", async () => {
    mockedSearch.mockResolvedValueOnce([]);
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("returns an empty list when Crossref throws", async () => {
    mockedSearch.mockRejectedValueOnce(new Error("network down"));
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("drops works without a DOI", async () => {
    mockedSearch.mockResolvedValueOnce([
      { title: "No DOI here", url: "https://crossref.org", citations: 5 },
    ]);
    expect(await loadResearchSignals()).toEqual([]);
  });

  it("maps a real Crossref work into a verified_work marketplace item with citation impact, never funding", async () => {
    mockedSearch.mockResolvedValueOnce([
      {
        title: "Sustaining Open Source Software",
        doi: "10.1234/abc.567",
        url: "https://doi.org/10.1234/abc.567",
        published: "2023-04-01",
        citations: 42,
      },
    ]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("crossref:10.1234/abc.567");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.type).toBe("research_request");
    expect(item.funding).toBeUndefined();
    expect(item.impactProfile).toEqual({
      measurable: true,
      signals: [
        expect.objectContaining({
          id: "crossref_citations",
          label: "Times cited",
          value: "42",
          scope: "artifact",
          source: "Crossref",
        }),
      ],
    });
  });

  it("marks impact not measurable when Crossref has no citation count", async () => {
    mockedSearch.mockResolvedValueOnce([
      {
        title: "Brand new preprint",
        doi: "10.1234/new.001",
        url: "https://doi.org/10.1234/new.001",
      },
    ]);
    const [item] = await loadResearchSignals();
    expect(item.impactProfile).toEqual({
      measurable: false,
      reason: expect.stringContaining("citation count"),
    });
  });
});
