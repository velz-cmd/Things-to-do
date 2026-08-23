import { describe, expect, it } from "vitest";
import { toCanonicalMarketRecord, toCanonicalSearchDocument } from "@/lib/discover/marketplace/canonical-record";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 3 item 31: canonical research search documents must contain DOI,
 * arXiv ID, OpenAlex ID, author names, ORCID, and publication source -
 * extending the Phase 1 search-document projection, not a second system.
 */
function researchOpportunity(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "research:doi:10.1234/example",
    slug: "research-example",
    title: "Reproducibility infrastructure for climate models",
    summary: "Published 2024.",
    description: "A confirmed scholarly-registry record.",
    type: "research_outcome",
    status: "confirmed",
    creator: { type: "individual", name: "Jane Smith et al.", verified: true },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2024-01-01",
    updatedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "confirmed_external_record",
    riskFlags: [],
    source: { type: "research_work", id: "doi:10.1234/example" },
    marketplaceKind: "verified_work",
    sourceUrl: "https://doi.org/10.1234/example",
    researchIdentity: {
      doi: "10.1234/example",
      openAlexId: "https://openalex.org/W123",
      arxivId: "2301.00001",
      arxivVersion: "v2",
      authors: [
        { name: "Jane Smith", orcid: "0000-0001-2345-6789" },
        { name: "John Doe" },
      ],
      containerTitle: "Journal of Climate Reproducibility",
      citations: [{ source: "OpenAlex", count: 31, observedAt: "2026-08-01T00:00:00.000Z" }],
      citingSample: [],
      referencedWorkIds: [],
    },
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("research canonical search document", () => {
  const record = toCanonicalMarketRecord(researchOpportunity());
  const doc = toCanonicalSearchDocument(record);

  it("indexes the DOI, OpenAlex ID, and arXiv ID as aliases", () => {
    expect(record.identity.aliases).toEqual(
      expect.arrayContaining(["10.1234/example", "https://openalex.org/W123", "2301.00001"]),
    );
    expect(doc.searchableTerms).toEqual(
      expect.arrayContaining(["10.1234/example", "https://openalex.org/W123", "2301.00001"]),
    );
  });

  it("indexes every co-author name, not only the display-summarized primary author", () => {
    expect(doc.searchableTerms).toContain("Jane Smith");
    expect(doc.searchableTerms).toContain("John Doe");
  });

  it("indexes ORCID when present", () => {
    expect(doc.searchableTerms).toContain("0000-0001-2345-6789");
  });

  it("indexes the publication source/journal", () => {
    expect(doc.searchableTerms).toContain("Journal of Climate Reproducibility");
  });

  it("sets canonicalSubject to the DOI for research records", () => {
    expect(record.identity.canonicalSubject).toBe("10.1234/example");
  });

  it("produces no search terms at all for a non-research item (no researchIdentity)", () => {
    const software = toCanonicalMarketRecord(
      researchOpportunity({
        researchIdentity: undefined,
        source: { type: "github_evidence", id: "evt-1" },
      }),
    );
    expect(software.searchTerms).toBeUndefined();
  });
});
