import { describe, expect, it } from "vitest";
import { normalizeGithubReleases } from "@/lib/discover/marketplace/read-model";
import type { FundingOpportunity } from "@/lib/github/types";

function repo(overrides: Partial<FundingOpportunity> = {}): FundingOpportunity {
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
 * Phase 2 item 2/5/14: real GitHub Releases as their own truthful outcome,
 * bounded, dedup-stable, never inflating role to "maintainer", and never
 * depending on a viewer's own GitHub connection (viewer-independent IDs).
 */
describe("normalizeGithubReleases", () => {
  it("produces nothing when no releases were observed", () => {
    expect(normalizeGithubReleases([repo()])).toEqual([]);
  });

  it("normalizes a real published release with a stable, viewer-independent canonical id", () => {
    const [item] = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 42,
            tagName: "v1.0.0",
            name: "First stable",
            publishedAt: "2026-08-01T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
            author: "octodev",
            prerelease: false,
          },
        ],
      }),
    ]);
    expect(item.id).toBe("github-release:acme/widgets:release:42");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.verificationStatus).toBe("verified_evidence_no_funding_rule");
  });

  it("never labels the release author as maintainer - only what GitHub actually proves", () => {
    const [item] = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 1,
            tagName: "v1.0.0",
            name: null,
            publishedAt: "2026-08-01T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
            author: "octodev",
            prerelease: false,
          },
        ],
      }),
    ]);
    expect(item.creator.type).not.toBe("maintainer");
    expect(item.summary.toLowerCase()).not.toContain("maintainer");
    expect(item.summary).toContain("published");
  });

  it("preserves prerelease semantics as a risk flag, never presenting it as a stable release", () => {
    const [item] = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 2,
            tagName: "v2.0.0-rc.1",
            name: "Release candidate",
            publishedAt: "2026-08-01T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v2.0.0-rc.1",
            author: "octodev",
            prerelease: true,
          },
        ],
      }),
    ]);
    expect(item.riskFlags).toContain("prerelease");
    expect(item.summary).toContain("prerelease");
  });

  it("bounds releases per repository rather than dumping unlimited history", () => {
    const releases = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      tagName: `v${i}.0.0`,
      name: `v${i}.0.0`,
      publishedAt: "2026-08-01T00:00:00.000Z",
      htmlUrl: `https://github.com/acme/widgets/releases/tag/v${i}.0.0`,
      author: "octodev",
      prerelease: false,
    }));
    const items = normalizeGithubReleases([repo({ releases })]);
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it("produces deterministic, unique IDs across releases - no dedup collisions", () => {
    const items = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 1,
            tagName: "v1.0.0",
            name: "v1.0.0",
            publishedAt: "2026-08-01T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
            author: "octodev",
            prerelease: false,
          },
          {
            id: 2,
            tagName: "v1.1.0",
            name: "v1.1.0",
            publishedAt: "2026-08-02T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.1.0",
            author: "octodev",
            prerelease: false,
          },
        ],
      }),
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it("skips a release with no published date or author (incomplete observation)", () => {
    const items = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 1,
            tagName: "v1.0.0",
            name: "v1.0.0",
            publishedAt: null,
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
            author: null,
            prerelease: false,
          },
        ],
      }),
    ]);
    expect(items).toEqual([]);
  });

  it("states what the release does and does not prove", () => {
    const [item] = normalizeGithubReleases([
      repo({
        releases: [
          {
            id: 1,
            tagName: "v1.0.0",
            name: "v1.0.0",
            publishedAt: "2026-08-01T00:00:00.000Z",
            htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
            author: "octodev",
            prerelease: false,
          },
        ],
      }),
    ]);
    expect(item.description.toLowerCase()).toContain("does not");
  });
});
