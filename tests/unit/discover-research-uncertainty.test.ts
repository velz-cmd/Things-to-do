import { describe, expect, it } from "vitest";
import { detectResearchUncertainties, describeResearchUncertainty } from "@/lib/discover/research/uncertainty";
import type { ResearchWork } from "@/lib/discover/research/types";

function work(overrides: Partial<ResearchWork> = {}): ResearchWork {
  return {
    key: "doi:10.1/example",
    title: "A Paper",
    authors: [],
    url: "https://doi.org/10.1/example",
    doi: "10.1/example",
    citations: [],
    referencedWorkIds: [],
    citingSample: [],
    sourceHealth: {},
    uncertainties: [],
    ...overrides,
  };
}

describe("detectResearchUncertainties", () => {
  it("detects a citation-count discrepancy between two sources", () => {
    const result = detectResearchUncertainties(
      work({
        citations: [
          { source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
          { source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    );
    expect(result).toContainEqual({
      kind: "citation_count_discrepancy",
      sources: ["Crossref", "OpenAlex"],
      values: [27, 31],
    });
  });

  it("never flags a discrepancy when both sources agree", () => {
    const result = detectResearchUncertainties(
      work({
        citations: [
          { source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
          { source: "OpenAlex", count: 27, observedAt: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    );
    expect(result.find((u) => u.kind === "citation_count_discrepancy")).toBeUndefined();
  });

  it("never flags a discrepancy from a single source alone", () => {
    const result = detectResearchUncertainties(
      work({ citations: [{ source: "Crossref", count: 27, observedAt: "2026-08-01T00:00:00.000Z" }] }),
    );
    expect(result.find((u) => u.kind === "citation_count_discrepancy")).toBeUndefined();
  });

  it("flags DOI unresolved when only an OpenAlex ID is known", () => {
    const result = detectResearchUncertainties(
      work({ doi: undefined, openAlexId: "https://openalex.org/W1" }),
    );
    expect(result).toContainEqual({ kind: "doi_unresolved", knownIdentity: "openalex" });
  });

  it("flags DOI unresolved when only an arXiv ID is known", () => {
    const result = detectResearchUncertainties(work({ doi: undefined, arxivId: "2301.00001" }));
    expect(result).toContainEqual({ kind: "doi_unresolved", knownIdentity: "arxiv" });
  });

  it("never flags DOI unresolved when a DOI is confirmed", () => {
    const result = detectResearchUncertainties(work({ doi: "10.1/example" }));
    expect(result.find((u) => u.kind === "doi_unresolved")).toBeUndefined();
  });

  it("returns no uncertainties for a fully clean, single-source, DOI-confirmed work", () => {
    const result = detectResearchUncertainties(
      work({ citations: [{ source: "Crossref", count: 5, observedAt: "2026-08-01T00:00:00.000Z" }] }),
    );
    expect(result).toEqual([]);
  });
});

describe("describeResearchUncertainty", () => {
  it("describes a citation discrepancy plainly, never as an alarm", () => {
    const text = describeResearchUncertainty({
      kind: "citation_count_discrepancy",
      sources: ["Crossref", "OpenAlex"],
      values: [27, 31],
    });
    expect(text).toBe("Citation indexes report different counts.");
    expect(text.toLowerCase()).not.toMatch(/error|conflict detected|warning/);
  });

  it("describes an unresolved DOI with the identity that IS known", () => {
    const text = describeResearchUncertainty({ kind: "doi_unresolved", knownIdentity: "arxiv" });
    expect(text).toContain("arXiv");
  });
});
