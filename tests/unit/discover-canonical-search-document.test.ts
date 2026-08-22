import { describe, expect, it } from "vitest";
import {
  toCanonicalMarketRecord,
  toCanonicalPoolRecord,
  toCanonicalAgentResultRecord,
  toCanonicalSearchDocument,
} from "@/lib/discover/marketplace/canonical-record";
import type { MarketplaceOpportunity, DiscoverPool } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 1G corrective: search-index foundation. Proves every domain
 * (software, research, media, request, pool, agent) produces a
 * deterministic searchable document from CanonicalMarketRecord - not the
 * Phase 12 search UI/engine itself.
 */
function baseOpportunity(overrides: Partial<MarketplaceOpportunity>): MarketplaceOpportunity {
  return {
    id: "id",
    slug: "slug",
    title: "Title",
    summary: "Summary",
    description: "Description",
    type: "grant",
    status: "active",
    creator: { type: "individual", name: "Someone", verified: true },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "test", id: "1" },
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("toCanonicalSearchDocument", () => {
  const software = toCanonicalMarketRecord(
    baseOpportunity({
      title: "Fix prototype pollution",
      source: { type: "github_evidence", id: "evt-1" },
      marketplaceKind: "verified_work",
      repository: "octocat/hello-world",
      creator: { type: "individual", name: "octodev", verified: true },
    }),
  );

  const research = toCanonicalMarketRecord(
    baseOpportunity({
      title: "Citation graph analysis",
      source: { type: "research_work", id: "10.1234/abc" },
      marketplaceKind: "verified_work",
      creator: { type: "individual", name: "Dr. Researcher", verified: true },
    }),
  );

  const media = toCanonicalMarketRecord(
    baseOpportunity({
      title: "Verified listen",
      source: { type: "listenbrainz_listen", id: "mbid-1" },
      marketplaceKind: "verified_work",
      creator: { type: "individual", name: "Artist Name", verified: true },
    }),
  );

  const request = toCanonicalMarketRecord(
    baseOpportunity({
      title: "Fix accessibility regression",
      source: { type: "resolve_request", id: "req-1" },
      marketplaceKind: "opportunity",
      creator: { type: "individual", name: "Requester", verified: true },
    }),
  );

  const pool: DiscoverPool = {
    id: "pool-1",
    name: "Security response fund",
    owner: "Operator",
    communitySlug: "react",
    observedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    purpose: "Fund security remediation",
    type: "security",
    eligibleOpportunityTypes: [],
    lifecycleState: "accepting_funding",
    publicationState: "approved",
    policyState: "active",
    treasuryReadiness: "ready",
    balanceUsd: 100,
    targetUsd: 500,
    primaryAction: { id: "capital.open_funding" } as DiscoverPool["primaryAction"],
    secondaryActions: [],
  };

  const agent = toCanonicalAgentResultRecord({
    subjectType: "verified_work",
    subjectId: "evt-1",
    result: {
      serviceId: "citation-verify",
      summary: "Citation verified.",
      occurredAt: "2026-08-03T00:00:00.000Z",
    },
  });

  it("produces a non-empty, deterministic search document for every domain", () => {
    const records = [software, research, media, request, toCanonicalPoolRecord(pool), agent];
    for (const record of records) {
      const doc = toCanonicalSearchDocument(record);
      expect(doc.canonicalId.length).toBeGreaterThan(0);
      expect(doc.searchableTerms.length).toBeGreaterThan(0);
      // Deterministic: calling twice on the same record yields identical output.
      expect(toCanonicalSearchDocument(record)).toEqual(doc);
    }
  });

  it("indexes repository identity for software", () => {
    const doc = toCanonicalSearchDocument(software);
    expect(doc.searchableTerms).toContain("octocat/hello-world");
    expect(doc.searchableTerms).toContain("Fix prototype pollution");
    expect(doc.searchableTerms).toContain("octodev");
  });

  it("indexes DOI identity for research via sourceRecordId, since canonicalSubject is absent", () => {
    const doc = toCanonicalSearchDocument(research);
    expect(doc.canonicalSubject).toBeUndefined();
    expect(doc.searchableTerms).toContain("10.1234/abc");
  });

  it("indexes creator identity for media", () => {
    const doc = toCanonicalSearchDocument(media);
    expect(doc.searchableTerms).toContain("Artist Name");
  });

  it("indexes Request title and requester", () => {
    const doc = toCanonicalSearchDocument(request);
    expect(doc.searchableTerms).toContain("Fix accessibility regression");
    expect(doc.searchableTerms).toContain("Requester");
  });

  it("indexes Pool name and community", () => {
    const doc = toCanonicalSearchDocument(toCanonicalPoolRecord(pool));
    expect(doc.searchableTerms).toContain("Security response fund");
    expect(doc.canonicalSubject).toBe("react");
  });

  it("indexes Agent service identity", () => {
    const doc = toCanonicalSearchDocument(agent);
    expect(doc.searchableTerms).toContain("citation-verify result");
  });

  it("never produces duplicate terms when title/subject/actor overlap", () => {
    const overlap = toCanonicalMarketRecord(
      baseOpportunity({
        title: "same-value",
        source: { type: "github_evidence", id: "same-value" },
        marketplaceKind: "verified_work",
        creator: { type: "individual", name: "same-value", verified: true },
      }),
    );
    const doc = toCanonicalSearchDocument(overlap);
    expect(doc.searchableTerms.filter((t) => t === "same-value")).toHaveLength(1);
  });
});
