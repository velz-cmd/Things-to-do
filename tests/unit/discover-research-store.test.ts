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
    uncertainties: [],
    observedSources: [],
    citingSampleObserved: false,
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

  /**
   * Phase 3 Part 1 hardening: participation (observedSources /
   * citingSampleObserved) - never array length - decides authoritative-
   * empty vs. retained-stale. A provider that genuinely succeeded with an
   * empty result must overwrite stale data; a provider that didn't
   * respond this run must never be presented as if it had.
   */
  it("OpenAlex succeeds with zero citations - zero remains authoritative, not merged away", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      citations: [{ source: "OpenAlex", count: 10, observedAt: "2026-08-01T00:00:00.000Z" }],
      observedSources: ["OpenAlex"],
    });
    const fresh = work({
      citations: [{ source: "OpenAlex", count: 0, observedAt: "2026-08-02T00:00:00.000Z" }],
      observedSources: ["OpenAlex"],
    });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citations).toEqual([
      { source: "OpenAlex", count: 0, observedAt: "2026-08-02T00:00:00.000Z" },
    ]);
  });

  it("OpenAlex succeeds with zero referenced works - previous reference list is authoritatively replaced", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({ referencedWorkIds: ["W1", "W2"] });
    const fresh = work({ referencedWorkIds: [], observedSources: ["OpenAlex"] });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.referencedWorkIds).toEqual([]);
  });

  it("OpenAlex referenced-work lookup did not run this run - previous reference list is retained, not blanked", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({ referencedWorkIds: ["W1", "W2"] });
    const fresh = work({ referencedWorkIds: [], observedSources: [] });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.referencedWorkIds).toEqual(["W1", "W2"]);
  });

  it("citing-sample lookup succeeds with zero results - previous sample is not falsely presented as fresh, replaced by authoritative empty", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({ citingSample: [{ id: "W9", title: "Old citing work" }] });
    const fresh = work({ citingSample: [], citingSampleObserved: true });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citingSample).toEqual([]);
  });

  it("citing-sample lookup did not run this run (bounded/not attempted) - previous sample is retained", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({ citingSample: [{ id: "W9", title: "Old citing work" }] });
    const fresh = work({ citingSample: [], citingSampleObserved: false });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citingSample).toEqual([{ id: "W9", title: "Old citing work" }]);
  });

  it("OpenAlex unavailable this run - previous citation/reference/citing data all retained together", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      citations: [{ source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" }],
      referencedWorkIds: ["W1"],
      citingSample: [{ id: "W2", title: "Citing work" }],
    });
    const fresh = work({ citations: [], referencedWorkIds: [], citingSample: [], observedSources: [] });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citations).toEqual(previous.citations);
    expect(merged.referencedWorkIds).toEqual(previous.referencedWorkIds);
    expect(merged.citingSample).toEqual(previous.citingSample);
  });

  it("Crossref unavailable this run - previous Crossref observation retained", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({
      citations: [{ source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" }],
    });
    const fresh = work({ citations: [], observedSources: [] });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.citations).toEqual(previous.citations);
  });

  it("arXiv unavailable this run - previous arXiv identity/version retained", async () => {
    const { mergeWithLastConfirmedResearch } = await import("@/lib/discover/research/store");
    const previous = work({ arxivId: "2301.00001", arxivVersion: "v3" });
    const fresh = work({ arxivId: undefined, arxivVersion: undefined, observedSources: [] });
    const merged = mergeWithLastConfirmedResearch(fresh, previous);
    expect(merged.arxivId).toBe("2301.00001");
    expect(merged.arxivVersion).toBe("v3");
  });
});

describe("computeResearchFingerprint (Phase 3 Part 2 - deterministic ordering)", () => {
  it("produces an identical fingerprint for identical semantic state regardless of array ordering", async () => {
    const { computeResearchFingerprint } = await import("@/lib/discover/research/store");
    const a = work({
      citations: [
        { source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
        { source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" },
      ],
      referencedWorkIds: ["W2", "W1"],
      citingSample: [{ id: "W9", title: "B" }, { id: "W1", title: "A" }],
    });
    const b = work({
      citations: [
        { source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" },
        { source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
      ],
      referencedWorkIds: ["W1", "W2"],
      citingSample: [{ id: "W1", title: "A" }, { id: "W9", title: "B" }],
    });
    expect(computeResearchFingerprint(a)).toBe(computeResearchFingerprint(b));
  });

  it("produces a different fingerprint when authorship order actually differs - never reorders authors", async () => {
    const { computeResearchFingerprint } = await import("@/lib/discover/research/store");
    const a = work({ authors: [{ name: "Jane Smith" }, { name: "John Doe" }] });
    const b = work({ authors: [{ name: "John Doe" }, { name: "Jane Smith" }] });
    expect(computeResearchFingerprint(a)).not.toBe(computeResearchFingerprint(b));
  });

  it("produces a different fingerprint when the citation count actually changes", async () => {
    const { computeResearchFingerprint } = await import("@/lib/discover/research/store");
    const a = work({ citations: [{ source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" }] });
    const b = work({ citations: [{ source: "OpenAlex", count: 32, observedAt: "2026-08-01T00:00:00.000Z" }] });
    expect(computeResearchFingerprint(a)).not.toBe(computeResearchFingerprint(b));
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
