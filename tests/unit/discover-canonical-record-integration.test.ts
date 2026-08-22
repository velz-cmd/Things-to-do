import { describe, expect, it } from "vitest";
import {
  toCanonicalMarketRecord,
  toCanonicalPoolRecord,
  toCanonicalAgentResultRecord,
} from "@/lib/discover/marketplace/canonical-record";
import type { MarketplaceOpportunity, DiscoverPool } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 1L integration test: one real MarketplaceOpportunity per domain
 * (software, research, media, community, request), one Pool, and one
 * persisted Agent result, all fed through the canonical market layer.
 * Asserts the invariants Phase 1 requires: stable canonical IDs, domain
 * separation, preserved provenance/impact classification, viewer-
 * independent identity (no userId anywhere in the contract), and no
 * fixture leakage into the shape itself.
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

describe("canonical market record - Phase 1 multi-domain integration", () => {
  const software = baseOpportunity({
    source: { type: "github_evidence", id: "evt-1" },
    marketplaceKind: "verified_work",
    repository: "octocat/hello-world",
    impactProfile: {
      measurable: true,
      signals: [
        {
          id: "dependent_repositories",
          label: "Dependent repositories",
          value: "42",
          scope: "repository",
          source: "Libraries.io",
          observedAt: "2026-08-01T00:00:00.000Z",
          classification: "observed",
        },
      ],
    },
  });

  const research = baseOpportunity({
    source: { type: "research_work", id: "10.1234/abc" },
    marketplaceKind: "verified_work",
    impactProfile: {
      measurable: true,
      signals: [
        {
          id: "crossref_citations",
          label: "Times cited (Crossref)",
          value: "27",
          scope: "artifact",
          source: "Crossref",
          observedAt: "2026-08-01T00:00:00.000Z",
          classification: "observed",
        },
      ],
    },
  });

  const media = baseOpportunity({
    source: { type: "listenbrainz_listen", id: "mbid-1" },
    marketplaceKind: "verified_work",
  });

  const community = baseOpportunity({
    source: { type: "open_collective_contribution", id: "oc-1" },
    marketplaceKind: "verified_work",
  });

  const request = baseOpportunity({
    source: { type: "resolve_request", id: "req-1" },
    marketplaceKind: "opportunity",
  });

  const pool: DiscoverPool = {
    id: "pool-1",
    name: "Security response fund",
    owner: "Operator",
    communitySlug: "react",
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

  const records = [
    toCanonicalMarketRecord(software),
    toCanonicalMarketRecord(research),
    toCanonicalMarketRecord(media),
    toCanonicalMarketRecord(community),
    toCanonicalMarketRecord(request),
    toCanonicalPoolRecord(pool),
    toCanonicalAgentResultRecord({
      subjectType: "verified_work",
      subjectId: "evt-1",
      result: { serviceId: "citation-verify", summary: "Citation verified.", occurredAt: "2026-08-03T00:00:00.000Z" },
    }),
  ];

  it("assigns a stable, non-empty canonical ID to every domain", () => {
    for (const r of records) {
      expect(r.identity.canonicalId.length).toBeGreaterThan(0);
    }
  });

  it("keeps all seven domains distinct", () => {
    const domains = records.map((r) => r.identity.domain);
    expect(new Set(domains).size).toBe(7);
    expect(domains).toEqual([
      "software",
      "research",
      "media",
      "community",
      "request",
      "pool",
      "agent",
    ]);
  });

  it("preserves provenance - every record states both what it proves and what it does not", () => {
    for (const r of records) {
      expect(r.provenance.provesClaim.length).toBeGreaterThan(0);
      expect(r.provenance.doesNotProveClaim.length).toBeGreaterThan(0);
    }
  });

  it("preserves impact classification for domains with real observed signals", () => {
    const softwareRecord = records[0];
    const researchRecord = records[1];
    expect(softwareRecord.impact[0].classification).toBe("observed");
    expect(researchRecord.impact[0].classification).toBe("observed");
  });

  it("never carries a viewer/userId field anywhere in the contract", () => {
    for (const r of records) {
      const json = JSON.stringify(r);
      expect(json).not.toMatch(/"viewerId"|"userId"/);
    }
  });

  it("keeps attribution and payout identity explicitly separate for every domain", () => {
    for (const r of records) {
      expect(r.attribution.payoutIdentitySeparate).toBe(true);
    }
  });

  it("contains no fixture/demo markers in any canonical record's own shape", () => {
    for (const r of records) {
      const json = JSON.stringify(r).toLowerCase();
      expect(json).not.toMatch(/\bdemo_|\bsample_|\bfake_|\bmock_/);
    }
  });
});
