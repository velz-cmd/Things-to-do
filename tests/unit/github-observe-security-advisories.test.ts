import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/npm-registry", () => ({
  findNpmPackagesForRepo: vi.fn(),
}));
vi.mock("@/lib/integrations/github-advisories", () => ({
  fetchAdvisoriesForNpmPackage: vi.fn(),
}));

import { findNpmPackagesForRepo } from "@/lib/integrations/npm-registry";
import { fetchAdvisoriesForNpmPackage } from "@/lib/integrations/github-advisories";
import { observeSecurityAdvisories } from "@/lib/github/opportunities";

const mockedNpmPackages = vi.mocked(findNpmPackagesForRepo);
const mockedAdvisories = vi.mocked(fetchAdvisoriesForNpmPackage);

/**
 * Phase 1 corrective B/Phase 2 item 1: this is the durable-pipeline
 * observation function (persisted via scanFundingOpportunity ->
 * persistOssOpportunitySnapshot), not the Redis-cached enrichment this
 * replaces. Confirms it never fabricates zero/empty state and never
 * claims "resolved" - only that a fix version was published.
 */
describe("observeSecurityAdvisories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns undefined (not yet observed) when no npm package is confirmed for the repository", async () => {
    mockedNpmPackages.mockResolvedValueOnce([]);
    const result = await observeSecurityAdvisories("acme", "widgets");
    expect(result).toBeUndefined();
    expect(mockedAdvisories).not.toHaveBeenCalled();
  });

  it("returns undefined when advisories exist but none define a patched version", async () => {
    mockedNpmPackages.mockResolvedValueOnce(["widgets"]);
    mockedAdvisories.mockResolvedValueOnce([
      {
        ghsaId: "GHSA-open",
        cveId: null,
        summary: "still open",
        severity: "high",
        publishedAt: "2026-08-01T00:00:00.000Z",
        patchedVersions: null,
        htmlUrl: "https://github.com/advisories/GHSA-open",
      },
    ]);
    const result = await observeSecurityAdvisories("acme", "widgets");
    expect(result).toBeUndefined();
  });

  it("returns a durable observation with full advisory-level provenance when a patched version is published", async () => {
    mockedNpmPackages.mockResolvedValueOnce(["widgets"]);
    mockedAdvisories.mockResolvedValueOnce([
      {
        ghsaId: "GHSA-real",
        cveId: "CVE-2026-0001",
        summary: "fixed",
        severity: "high",
        publishedAt: "2026-08-01T00:00:00.000Z",
        patchedVersions: ">=2.0.1",
        htmlUrl: "https://github.com/advisories/GHSA-real",
      },
    ]);
    const result = await observeSecurityAdvisories("acme", "widgets");
    expect(result).toMatchObject({
      advisoriesWithPublishedFix: [
        {
          ghsaId: "GHSA-real",
          cveId: "CVE-2026-0001",
          patchedVersions: ">=2.0.1",
          htmlUrl: "https://github.com/advisories/GHSA-real",
        },
      ],
    });
    expect(new Date(result!.observedAt).toISOString()).toBe(result!.observedAt);
  });

  it("never throws when the npm connector fails - returns undefined instead", async () => {
    mockedNpmPackages.mockRejectedValueOnce(new Error("npm outage"));
    const result = await observeSecurityAdvisories("acme", "widgets");
    expect(result).toBeUndefined();
  });
});
