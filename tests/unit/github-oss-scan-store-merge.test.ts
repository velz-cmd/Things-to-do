import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FundingOpportunity } from "@/lib/github/types";

const { findUnique, upsertScan, upsertSnapshot, prisma } = vi.hoisted(() => {
  const findUnique = vi.fn();
  const upsertScan = vi.fn();
  const upsertSnapshot = vi.fn();
  return {
    findUnique,
    upsertScan,
    upsertSnapshot,
    prisma: {
      githubOssScan: { findUnique, upsert: upsertScan },
      discoverRepositorySnapshot: { upsert: upsertSnapshot },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/discover/marketplace/cache", () => ({
  invalidateDiscoverGithubCache: vi.fn(),
}));

function opportunity(overrides: Partial<FundingOpportunity> = {}): FundingOpportunity {
  return {
    id: "opp-acme-widgets",
    owner: "acme",
    repo: "widgets",
    fullName: "acme/widgets",
    stars: 10,
    forks: 2,
    health: {
      score: 80,
      grade: "B",
      signals: [],
      maintainerCount: 1,
      fundingGapUsd: 0,
      headline: "Healthy",
    },
    unfundedMaintainers: 1,
    highImpactPrs: 0,
    headline: "headline",
    priority: "medium",
    live: true,
    ...overrides,
  };
}

/**
 * Phase 2 item 6/7: a transient connector failure during one scan must
 * never erase a previously confirmed observation. This proves
 * persistOssOpportunitySnapshot merges against the last confirmed
 * githubOssScan row rather than blindly overwriting with the fresh
 * scan's (possibly incomplete) fields.
 */
describe("persistOssOpportunitySnapshot - merge with last confirmed", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsertScan.mockReset().mockResolvedValue({});
    upsertSnapshot.mockReset().mockResolvedValue({});
  });

  it("keeps the previously confirmed security observation when the fresh scan didn't observe it this run", async () => {
    const previous = opportunity({
      security: {
        advisoriesWithPublishedFix: [
          { ghsaId: "GHSA-real", cveId: null, patchedVersions: ">=2.0.1", htmlUrl: "https://github.com/advisories/GHSA-real" },
        ],
        observedAt: "2026-08-01T00:00:00.000Z",
      },
    });
    findUnique.mockResolvedValueOnce({ payloadJson: JSON.stringify(previous) });

    const { persistOssOpportunitySnapshot } = await import("@/lib/github/oss-scan-store");
    const fresh = opportunity({ security: undefined }); // this run's advisory fetch failed/timed out
    await persistOssOpportunitySnapshot(fresh);

    const persistedPayload = JSON.parse(upsertScan.mock.calls[0][0].create.payloadJson);
    expect(persistedPayload.security).toEqual(previous.security);
  });

  it("keeps the previously confirmed releases/adoption/funding-context when the fresh scan omitted them", async () => {
    const previous = opportunity({
      adoption: { dependentRepoCount: 38, source: "Libraries.io", observedAt: "2026-08-01T00:00:00.000Z" },
      releases: [
        { id: 1, tagName: "v1.0.0", name: "v1.0.0", publishedAt: "2026-08-01T00:00:00.000Z", htmlUrl: "https://x", author: "octodev", prerelease: false },
      ],
      externalFundingContext: {
        channels: [{ provider: "patreon", account: "real", url: "https://www.patreon.com/real" }],
        observedAt: "2026-08-01T00:00:00.000Z",
      },
    });
    findUnique.mockResolvedValueOnce({ payloadJson: JSON.stringify(previous) });

    const { persistOssOpportunitySnapshot } = await import("@/lib/github/oss-scan-store");
    const fresh = opportunity({ adoption: undefined, releases: undefined, externalFundingContext: undefined });
    await persistOssOpportunitySnapshot(fresh);

    const persistedPayload = JSON.parse(upsertScan.mock.calls[0][0].create.payloadJson);
    expect(persistedPayload.adoption).toEqual(previous.adoption);
    expect(persistedPayload.releases).toEqual(previous.releases);
    expect(persistedPayload.externalFundingContext).toEqual(previous.externalFundingContext);
  });

  it("prefers the fresh observation when the current scan actually observed something new", async () => {
    const previous = opportunity({
      adoption: { dependentRepoCount: 10, source: "Libraries.io", observedAt: "2026-08-01T00:00:00.000Z" },
    });
    findUnique.mockResolvedValueOnce({ payloadJson: JSON.stringify(previous) });

    const { persistOssOpportunitySnapshot } = await import("@/lib/github/oss-scan-store");
    const fresh = opportunity({
      adoption: { dependentRepoCount: 42, source: "Libraries.io", observedAt: "2026-08-02T00:00:00.000Z" },
    });
    await persistOssOpportunitySnapshot(fresh);

    const persistedPayload = JSON.parse(upsertScan.mock.calls[0][0].create.payloadJson);
    expect(persistedPayload.adoption.dependentRepoCount).toBe(42);
  });

  it("persists the fresh scan as-is when there is no previous confirmed row (first-ever scan)", async () => {
    findUnique.mockResolvedValueOnce(null);
    const { persistOssOpportunitySnapshot } = await import("@/lib/github/oss-scan-store");
    const fresh = opportunity({ security: undefined });
    await persistOssOpportunitySnapshot(fresh);

    const persistedPayload = JSON.parse(upsertScan.mock.calls[0][0].create.payloadJson);
    expect(persistedPayload.security).toBeUndefined();
  });

  it("never throws when the lookup for the previous row itself fails", async () => {
    findUnique.mockRejectedValueOnce(new Error("db outage"));
    const { persistOssOpportunitySnapshot } = await import("@/lib/github/oss-scan-store");
    await expect(persistOssOpportunitySnapshot(opportunity())).resolves.toBeDefined();
  });
});
