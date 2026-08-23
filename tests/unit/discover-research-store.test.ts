import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchWork } from "@/lib/discover/research/types";

const { findUnique, upsert, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { discoverResearchSnapshot: { findUnique, upsert, findMany } },
}));

function work(overrides: Partial<ResearchWork> = {}): ResearchWork {
  return {
    key: "doi:10.1/example",
    title: "A Paper",
    authors: [{ name: "Jane Smith" }],
    url: "https://doi.org/10.1/example",
    doi: "10.1/example",
    citations: [],
    referencedWorkIds: [],
    citingSample: [],
    sourceHealth: {},
    ...overrides,
  };
}

describe("mergeWithLastConfirmedResearch (Phase 3 Part B3)", () => {
  it("returns the fresh record unchanged when there is no previous confirmed state", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const fresh = work();
    expect(mergeWithLastConfirmedResearch(fresh, null)).toEqual(fresh);
  });

  it("retains a source's prior citation observation when the fresh run didn't refresh that source", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      citations: [
        { source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
        { source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" },
      ],
      citingSample: [{ id: "W2", title: "Citing work" }],
      arxivId: "2301.00001",
      arxivVersion: "v3",
    });
    // Today: Crossref succeeds with a changed count, OpenAlex failed this run (absent from fresh).
    const fresh = work({
      citations: [{ source: "Crossref", count: 28, observedAt: "2026-08-02T00:00:00.000Z" }],
      citingSample: [],
      arxivId: undefined,
      arxivVersion: undefined,
    });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citations).toEqual(
      expect.arrayContaining([
        { source: "Crossref", count: 28, observedAt: "2026-08-02T00:00:00.000Z" },
        { source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" },
      ]),
    );
    expect(merged.citingSample).toEqual([{ id: "W2", title: "Citing work" }]);
    expect(merged.arxivId).toBe("2301.00001");
    expect(merged.arxivVersion).toBe("v3");
  });

  it("never blanks authors/date/container to empty when the fresh run didn't observe them", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      authors: [{ name: "Jane Smith" }, { name: "John Doe" }],
      containerTitle: "Journal of Examples",
      publicationYear: 2024,
    });
    const fresh = work({ authors: [], containerTitle: undefined, publicationYear: undefined });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.authors).toEqual(previous.authors);
    expect(merged.containerTitle).toBe("Journal of Examples");
    expect(merged.publicationYear).toBe(2024);
  });

  it("prefers the fresh observation when it actually reports a real change", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      citations: [{ source: "OpenAlex", count: 10, observedAt: "2026-08-01T00:00:00.000Z" }],
    });
    const fresh = work({
      citations: [{ source: "OpenAlex", count: 42, observedAt: "2026-08-02T00:00:00.000Z" }],
    });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citations).toEqual([
      { source: "OpenAlex", count: 42, observedAt: "2026-08-02T00:00:00.000Z" },
    ]);
  });
});

describe("persistResearchSnapshot / loadStoredResearchWorks", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset().mockResolvedValue({});
    findMany.mockReset().mockResolvedValue([]);
  });

  it("persists a first-ever observation with no previous row to merge against", async () => {
    findUnique.mockResolvedValueOnce(null);
    const { persistResearchSnapshot } = await import("@/lib/discover/research/store");
    const result = await persistResearchSnapshot(work());
    expect(result.persisted).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("merges against the previously persisted row before writing", async () => {
    const previous = work({
      citations: [{ source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" }],
    });
    findUnique.mockResolvedValueOnce({ payloadJson: JSON.stringify(previous) });
    const { persistResearchSnapshot } = await import("@/lib/discover/research/store");
    const fresh = work({ citations: [] });
    await persistResearchSnapshot(fresh);
    const written = JSON.parse(upsert.mock.calls[0][0].create.payloadJson);
    expect(written.citations).toEqual(previous.citations);
  });

  it("reports persisted:false rather than throwing when the table is missing (cold start)", async () => {
    findUnique.mockRejectedValueOnce(
      Object.assign(new Error("relation does not exist"), { code: "P2021" }),
    );
    const { persistResearchSnapshot } = await import("@/lib/discover/research/store");
    const result = await persistResearchSnapshot(work());
    expect(result.persisted).toBe(false);
  });

  it("returns an empty array (not a thrown error) when the durable table is missing", async () => {
    findMany.mockRejectedValueOnce(
      Object.assign(new Error("relation does not exist"), { code: "P2021" }),
    );
    const { loadStoredResearchWorks } = await import("@/lib/discover/research/store");
    expect(await loadStoredResearchWorks()).toEqual([]);
  });

  it("reads back real persisted works", async () => {
    findMany.mockResolvedValueOnce([{ payloadJson: JSON.stringify(work()) }]);
    const { loadStoredResearchWorks } = await import("@/lib/discover/research/store");
    const works = await loadStoredResearchWorks();
    expect(works).toHaveLength(1);
    expect(works[0].key).toBe("doi:10.1/example");
  });

  it("skips a corrupt row rather than failing the entire read", async () => {
    findMany.mockResolvedValueOnce([
      { payloadJson: "{not json" },
      { payloadJson: JSON.stringify(work()) },
    ]);
    const { loadStoredResearchWorks } = await import("@/lib/discover/research/store");
    const works = await loadStoredResearchWorks();
    expect(works).toHaveLength(1);
  });
});
