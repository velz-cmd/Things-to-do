import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FundingOpportunity } from "@/lib/github/types";

const { githubRows, snapshotRows, prisma } = vi.hoisted(() => {
  const githubRows = vi.fn();
  const snapshotRows = vi.fn();
  return {
    githubRows,
    snapshotRows,
    prisma: {
      githubOssScan: { findMany: githubRows },
      discoverRepositorySnapshot: { findMany: snapshotRows },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/discover/marketplace/cache", () => ({
  invalidateDiscoverGithubCache: vi.fn(),
}));
vi.mock("@/lib/github/opportunities", () => ({
  scanAllOpportunities: vi.fn(),
  scanFundingOpportunity: vi.fn(),
}));

function opportunity(fullName: string, headline: string): FundingOpportunity {
  const [owner, repo] = fullName.split("/") as [string, string];
  return {
    id: `opp-${owner}-${repo}`,
    owner,
    repo,
    fullName,
    stars: 1,
    forks: 0,
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
    headline,
    priority: "medium",
    live: true,
    activity: {
      observedAt: new Date().toISOString(),
      rangeStart: null,
      rangeEnd: new Date().toISOString(),
      records: [],
      counts: {
        code: 0,
        review: 0,
        documentation: 0,
        issue_resolution: 0,
        release_work: 0,
        support: 0,
        security: 0,
      },
      contributors: [],
    },
  };
}

describe("GitHub OSS persisted store", () => {
  beforeEach(() => {
    githubRows.mockReset().mockResolvedValue([]);
    snapshotRows.mockReset().mockResolvedValue([]);
  });

  it("falls back per repository when an aggregate payload is corrupt", async () => {
    const valid = opportunity(
      "velz-cmd/repodiet-e2e-test",
      "immutable snapshot",
    );
    githubRows.mockResolvedValue([
      {
        owner: valid.owner,
        repo: valid.repo,
        fullName: valid.fullName,
        payloadJson: "{broken",
        scannedAt: new Date(),
      },
    ]);
    snapshotRows.mockResolvedValue([
      {
        owner: valid.owner,
        repo: valid.repo,
        fullName: valid.fullName,
        payload: valid,
        observedAt: new Date(Date.now() - 1_000),
      },
    ]);

    const { loadStoredOssOpportunities } = await import(
      "@/lib/github/oss-scan-store"
    );
    const result = await loadStoredOssOpportunities();

    expect(result.opportunities).toEqual([
      expect.objectContaining({
        fullName: valid.fullName,
        headline: "immutable snapshot",
      }),
    ]);
  });

  it("selects the newest valid record per repository across both tables", async () => {
    const older = opportunity("owner/repo", "older aggregate");
    const newer = opportunity("owner/repo", "newer immutable snapshot");
    githubRows.mockResolvedValue([
      {
        owner: older.owner,
        repo: older.repo,
        fullName: older.fullName,
        payloadJson: JSON.stringify(older),
        scannedAt: new Date(Date.now() - 60_000),
      },
    ]);
    snapshotRows.mockResolvedValue([
      {
        owner: newer.owner,
        repo: newer.repo,
        fullName: newer.fullName,
        payload: newer,
        observedAt: new Date(),
      },
    ]);

    const { loadStoredOssOpportunities } = await import(
      "@/lib/github/oss-scan-store"
    );
    const result = await loadStoredOssOpportunities();

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.headline).toBe("newer immutable snapshot");
  });

  it("reports staleness per repository", async () => {
    const fresh = opportunity("owner/fresh", "fresh");
    const stale = opportunity("owner/stale", "stale");
    githubRows.mockResolvedValue([
      {
        owner: fresh.owner,
        repo: fresh.repo,
        fullName: fresh.fullName,
        payloadJson: JSON.stringify(fresh),
        scannedAt: new Date(),
      },
      {
        owner: stale.owner,
        repo: stale.repo,
        fullName: stale.fullName,
        payloadJson: JSON.stringify(stale),
        scannedAt: new Date(Date.now() - 7 * 60 * 60_000),
      },
    ]);

    const { loadStoredOssOpportunities } = await import(
      "@/lib/github/oss-scan-store"
    );
    const result = await loadStoredOssOpportunities();

    expect(result.meta.stale).toBe(false);
    expect(result.meta.staleRepositories).toEqual(["owner/stale"]);
  });
});
