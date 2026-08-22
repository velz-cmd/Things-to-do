import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache/kv", () => ({
  cacheGetOrSetResilient: vi.fn((_key: string, _ttl: number, factory: () => Promise<unknown>) =>
    factory(),
  ),
}));
vi.mock("@/lib/integrations/npm-registry", () => ({
  findNpmPackagesForRepo: vi.fn(),
}));
vi.mock("@/lib/integrations/github-advisories", () => ({
  fetchAdvisoriesForNpmPackage: vi.fn(),
}));

import { findNpmPackagesForRepo } from "@/lib/integrations/npm-registry";
import { fetchAdvisoriesForNpmPackage } from "@/lib/integrations/github-advisories";
import { attachSecurityAdvisorySignals } from "@/lib/discover/marketplace/security-advisory-signal-source";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

const mockedNpmPackages = vi.mocked(findNpmPackagesForRepo);
const mockedAdvisories = vi.mocked(fetchAdvisoriesForNpmPackage);

function work(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "github-work:1",
    slug: "work-1",
    title: "Security release",
    summary: "",
    description: "",
    type: "repository_fix",
    status: "verified",
    creator: { type: "individual", name: "maintainer", verified: true },
    repository: "acme/widgets",
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "verified_evidence_no_funding_rule",
    riskFlags: [],
    source: { type: "github_evidence", id: "1" },
    marketplaceKind: "verified_work",
    impactProfile: { measurable: false, reason: "not yet measurable" },
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("attachSecurityAdvisorySignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves items unchanged when no npm package is confirmed for the repository", async () => {
    mockedNpmPackages.mockResolvedValueOnce([]);
    const [item] = await attachSecurityAdvisorySignals([work()]);
    expect(item.impactProfile).toEqual({ measurable: false, reason: "not yet measurable" });
    expect(mockedAdvisories).not.toHaveBeenCalled();
  });

  it("leaves items unchanged when advisories exist but none are resolved (patched)", async () => {
    mockedNpmPackages.mockResolvedValueOnce(["widgets"]);
    mockedAdvisories.mockResolvedValueOnce([
      {
        ghsaId: "GHSA-open",
        cveId: null,
        summary: "Still open",
        severity: "high",
        publishedAt: "2026-08-01T00:00:00.000Z",
        patchedVersions: null,
        htmlUrl: "https://github.com/advisories/GHSA-open",
      },
    ]);
    const [item] = await attachSecurityAdvisorySignals([work()]);
    expect(item.impactProfile).toEqual({ measurable: false, reason: "not yet measurable" });
  });

  it("adds a resolved-security-advisories signal, scoped to repository, composed alongside existing signals", async () => {
    mockedNpmPackages.mockResolvedValueOnce(["widgets"]);
    mockedAdvisories.mockResolvedValueOnce([
      {
        ghsaId: "GHSA-fixed",
        cveId: "CVE-2026-0001",
        summary: "Fixed",
        severity: "high",
        publishedAt: "2026-08-01T00:00:00.000Z",
        patchedVersions: ">=2.0.1",
        htmlUrl: "https://github.com/advisories/GHSA-fixed",
      },
    ]);
    const already = work({
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "dependent_repositories",
            label: "Dependent repositories",
            value: "38",
            scope: "repository",
            source: "Libraries.io",
            observedAt: "2026-08-01T00:00:00.000Z",
            classification: "observed",
          },
        ],
      },
    });
    const [item] = await attachSecurityAdvisorySignals([already]);
    expect(item.impactProfile?.measurable).toBe(true);
    if (item.impactProfile?.measurable) {
      expect(item.impactProfile.signals.map((s) => s.id).sort()).toEqual([
        "dependent_repositories",
        "resolved_security_advisories",
      ]);
      const security = item.impactProfile.signals.find(
        (s) => s.id === "resolved_security_advisories",
      );
      expect(security).toMatchObject({
        value: "1",
        scope: "repository",
        source: "GitHub Security Advisories",
        classification: "observed",
      });
    }
  });

  it("skips items with no repository or non-github sources", async () => {
    const nonGithub = work({ source: { type: "open_collective_contribution", id: "x" }, repository: undefined });
    const result = await attachSecurityAdvisorySignals([nonGithub]);
    expect(mockedNpmPackages).not.toHaveBeenCalled();
    expect(result[0]).toBe(nonGithub);
  });
});
