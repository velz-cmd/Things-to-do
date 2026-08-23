import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/crossref", () => ({
  searchCrossrefDetailed: vi.fn(),
  pingCrossref: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));
vi.mock("@/lib/integrations/openalex", () => ({
  searchOpenAlexWorksDetailed: vi.fn(),
  fetchCitingWorksForOpenAlexId: vi.fn().mockResolvedValue([]),
  pingOpenAlex: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));
vi.mock("@/lib/integrations/arxiv", () => ({
  searchArxivWorksDetailed: vi.fn().mockResolvedValue({
    status: "ok",
    records: [],
    attemptedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:00.000Z",
  }),
  pingArxiv: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
}));
vi.mock("@/lib/discover/research/store", () => ({
  persistResearchSnapshot: vi.fn().mockResolvedValue({ persisted: true }),
  loadStoredResearchWorks: vi.fn().mockResolvedValue([]),
}));

import { searchCrossrefDetailed } from "@/lib/integrations/crossref";
import { searchOpenAlexWorksDetailed, fetchCitingWorksForOpenAlexId } from "@/lib/integrations/openalex";
import { searchArxivWorksDetailed } from "@/lib/integrations/arxiv";
import { persistResearchSnapshot, loadStoredResearchWorks } from "@/lib/discover/research/store";
import { refreshResearchMarket, loadResearchSignals } from "@/lib/discover/marketplace/research-signal-source";
import { OPEN_RESEARCH_QUERIES } from "@/lib/sensors/targets";
import type { ResearchWork } from "@/lib/discover/research/types";

const mockedCrossref = vi.mocked(searchCrossrefDetailed);
const mockedOpenAlex = vi.mocked(searchOpenAlexWorksDetailed);
const mockedArxiv = vi.mocked(searchArxivWorksDetailed);
const mockedCitingWorks = vi.mocked(fetchCitingWorksForOpenAlexId);
const mockedPersist = vi.mocked(persistResearchSnapshot);
const mockedLoadStored = vi.mocked(loadStoredResearchWorks);

const ATTEMPTED = "2026-08-01T00:00:00.000Z";
const ok = <T>(records: T[]) => ({ status: "ok" as const, records, attemptedAt: ATTEMPTED, completedAt: ATTEMPTED });
const unavailable = <T>(): { status: "unavailable"; records: T[]; attemptedAt: string; completedAt: string; sanitizedReason: string } => ({
  status: "unavailable",
  records: [],
  attemptedAt: ATTEMPTED,
  completedAt: ATTEMPTED,
  sanitizedReason: "The source is unavailable.",
});

function researchWork(overrides: Partial<ResearchWork> = {}): ResearchWork {
  return {
    key: "doi:10.1234/abc.567",
    title: "Sustaining Open Source Software",
    authors: [{ name: "Ada Lovelace" }],
    url: "https://doi.org/10.1234/abc.567",
    doi: "10.1234/abc.567",
    citations: [{ source: "OpenAlex", count: 42, observedAt: ATTEMPTED }],
    referencedWorkIds: [],
    citingSample: [],
    sourceHealth: {},
    ...overrides,
  };
}

describe("refreshResearchMarket - live multi-provider fetch + persist (Part C)", () => {
  beforeEach(() => {
    mockedCrossref.mockReset().mockResolvedValue(ok([]));
    mockedOpenAlex.mockReset().mockResolvedValue(ok([]));
    mockedArxiv.mockReset().mockResolvedValue(ok([]));
    mockedCitingWorks.mockReset().mockResolvedValue([]);
    mockedPersist.mockReset().mockResolvedValue({ persisted: true });
  });

  it("calls Crossref/OpenAlex/arXiv once per configured research target, never one hardcoded query", async () => {
    await refreshResearchMarket();
    expect(mockedCrossref).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
    expect(mockedOpenAlex).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
    expect(mockedArxiv).toHaveBeenCalledTimes(OPEN_RESEARCH_QUERIES.length);
  });

  it("refreshes and persists nothing when every connector returns nothing", async () => {
    const result = await refreshResearchMarket();
    expect(result).toEqual({ refreshed: 0, persisted: 0 });
    expect(mockedPersist).not.toHaveBeenCalled();
  });

  it("refreshes and persists nothing when every connector is unavailable", async () => {
    mockedCrossref.mockResolvedValue(unavailable());
    mockedOpenAlex.mockResolvedValue(unavailable());
    mockedArxiv.mockResolvedValue(unavailable());
    const result = await refreshResearchMarket();
    expect(result).toEqual({ refreshed: 0, persisted: 0 });
  });

  it("persists a real merged Crossref+OpenAlex work with both citation observations separate", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      ok(
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
      ),
    );
    mockedOpenAlex.mockImplementation(async (query: string) =>
      ok(
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
      ),
    );
    const result = await refreshResearchMarket();
    expect(result.refreshed).toBe(1);
    expect(result.persisted).toBe(1);
    const persistedWork = mockedPersist.mock.calls[0][0];
    expect(persistedWork.key).toBe("doi:10.1234/abc.567");
    expect(persistedWork.citations.map((c) => c.source).sort()).toEqual(["Crossref", "OpenAlex"]);
  });

  it("bounds citing-work lookups rather than firing one extra request per row", async () => {
    mockedOpenAlex.mockImplementation(async (query: string) =>
      ok(
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
      ),
    );
    await refreshResearchMarket();
    expect(mockedCitingWorks.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("computes independent per-provider source health from real status, not result-array length (Part A2/D)", async () => {
    mockedCrossref.mockImplementation(async (query: string) =>
      ok(
        query === OPEN_RESEARCH_QUERIES[0]
          ? [{ title: "A paper", doi: "10.1/a", url: "https://doi.org/10.1/a", citations: 5, authors: [] }]
          : [],
      ),
    );
    mockedOpenAlex.mockResolvedValue(unavailable());
    await refreshResearchMarket();
    const persistedWork = mockedPersist.mock.calls[0][0];
    expect(persistedWork.sourceHealth.Crossref?.status).toBe("healthy");
    expect(persistedWork.sourceHealth.OpenAlex?.status).not.toBe("healthy");
  });
});

describe("loadResearchSignals - durable read-only render path (Part C4)", () => {
  beforeEach(() => {
    mockedLoadStored.mockReset().mockResolvedValue([]);
    mockedCrossref.mockReset();
    mockedOpenAlex.mockReset();
    mockedArxiv.mockReset();
  });

  it("never calls any provider connector - reads only the durable store", async () => {
    mockedLoadStored.mockResolvedValue([researchWork()]);
    await loadResearchSignals();
    expect(mockedCrossref).not.toHaveBeenCalled();
    expect(mockedOpenAlex).not.toHaveBeenCalled();
    expect(mockedArxiv).not.toHaveBeenCalled();
  });

  it("returns an empty list on a cold/empty durable store, without triggering a live scan", async () => {
    expect(await loadResearchSignals()).toEqual([]);
    expect(mockedCrossref).not.toHaveBeenCalled();
  });

  it("maps a persisted research work into a research_outcome verified_work item with citation impact, never funding", async () => {
    mockedLoadStored.mockResolvedValue([researchWork()]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:doi:10.1234/abc.567");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.type).toBe("research_outcome");
    expect(item.funding).toBeUndefined();
    expect(item.economicMatch).toBeUndefined();
    expect(item.creator.name).toBe("Ada Lovelace");
  });

  it("shows a real et-al author display for multi-author works", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({ authors: [{ name: "Jane Smith" }, { name: "John Doe" }] }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.creator.name).toBe("Jane Smith et al.");
  });

  it("keeps an OpenAlex-only work keyed by its OpenAlex ID", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({ key: "openalex:W999", doi: undefined, openAlexId: "https://openalex.org/W999" }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:openalex:W999");
  });

  it("includes real arXiv-only works, distinct from the PR/issue title heuristic", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({
        key: "arxiv:2301.00001",
        doi: undefined,
        arxivId: "2301.00001",
        authors: [{ name: "Jane Smith" }],
      }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.id).toBe("research:arxiv:2301.00001");
  });

  it("A1: never fabricates a January 1 publication-date claim for a year-only date", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({ publishedDate: undefined, publicationYear: 2024, datePrecision: "year" }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.summary).toBe("Published 2024.");
    expect(item.summary).not.toContain("01-01");
    expect(item.researchIdentity?.publicationDate).toBeUndefined();
    expect(item.researchIdentity?.publicationYear).toBe(2024);
    expect(item.researchIdentity?.publicationDatePrecision).toBe("year");
  });

  it("A3: falls back canonical identity to arXiv ID when no DOI/OpenAlex ID exists", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({ key: "arxiv:2301.00099", doi: undefined, arxivId: "2301.00099" }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.researchIdentity?.arxivId).toBe("2301.00099");
    expect(item.researchIdentity?.doi).toBeUndefined();
  });

  it("A4: assigns no forced primaryAction - only quiet source navigation in secondaryActions", async () => {
    mockedLoadStored.mockResolvedValue([researchWork()]);
    const [item] = await loadResearchSignals();
    expect(item.primaryAction).toBeUndefined();
    expect(item.secondaryActions).toHaveLength(1);
    expect(item.secondaryActions?.[0]?.id).toBe("discover.open_evidence");
  });

  it("carries persisted per-provider source health through to the rendered item", async () => {
    mockedLoadStored.mockResolvedValue([
      researchWork({
        sourceHealth: {
          Crossref: { status: "healthy", lastSuccessfulRefreshAt: ATTEMPTED, lastAttemptAt: ATTEMPTED },
          OpenAlex: { status: "unavailable", lastSuccessfulRefreshAt: null, lastAttemptAt: ATTEMPTED },
        },
      }),
    ]);
    const [item] = await loadResearchSignals();
    expect(item.researchIdentity?.sourceHealth.Crossref?.status).toBe("healthy");
    expect(item.researchIdentity?.sourceHealth.OpenAlex?.status).toBe("unavailable");
  });

  it("produces deterministic ordering across repeated reads regardless of store row order", async () => {
    const a = researchWork({ key: "doi:10.1/a", title: "A" });
    const b = researchWork({ key: "doi:10.1/b", title: "B" });
    mockedLoadStored.mockResolvedValueOnce([b, a]);
    const first = await loadResearchSignals();
    mockedLoadStored.mockResolvedValueOnce([a, b]);
    const second = await loadResearchSignals();
    expect(first.map((i) => i.id)).toEqual(second.map((i) => i.id));
  });
});
