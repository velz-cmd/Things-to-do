import { describe, expect, it } from "vitest";
import {
  normalizeGithubAcceptedWork,
  normalizeGithubReleases,
} from "@/lib/discover/marketplace/read-model";
import type { FundingOpportunity } from "@/lib/github/types";
import type { GitHubFundingActivityRecord } from "@/lib/github/types";

/**
 * Phase 2 item 2: GitHub evidence proves contributor/PR-author/release-
 * publisher roles - it never automatically proves "maintainer" or
 * "payout-ready". These are negative tests: every software outcome
 * creator built from raw GitHub evidence must NOT be labeled maintainer,
 * and payout readiness must never be inferred from GitHub identity alone.
 */
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

function acceptedRecord(
  overrides: Partial<GitHubFundingActivityRecord> = {},
): GitHubFundingActivityRecord {
  return {
    id: "pr:acme/widgets:1",
    category: "code",
    title: "Fix bug",
    actor: "octodev",
    occurredAt: "2026-08-01T00:00:00.000Z",
    sourceUrl: "https://github.com/acme/widgets/pull/1",
    sourceKind: "pull_request",
    ...overrides,
  };
}

describe("GitHub role truth - no maintainer inflation", () => {
  it("a PR author is labeled by GitHub identity, never automatically 'maintainer'", () => {
    const [item] = normalizeGithubAcceptedWork([
      repo({ activity: { observedAt: "2026-08-01T00:00:00.000Z", rangeStart: null, rangeEnd: "2026-08-01T00:00:00.000Z", records: [acceptedRecord()], counts: {}, contributors: [] } }),
    ]);
    expect(item.creator.type).not.toBe("maintainer");
    expect(item.creator.type).toBe("individual");
  });

  it("a release publisher is labeled by GitHub identity, never automatically 'maintainer'", () => {
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
    expect(item.creator.type).not.toBe("maintainer");
  });

  it("a repository contributor's entityState is never marked payout-ready from GitHub identity alone", () => {
    const [item] = normalizeGithubAcceptedWork([
      repo({ activity: { observedAt: "2026-08-01T00:00:00.000Z", rangeStart: null, rangeEnd: "2026-08-01T00:00:00.000Z", records: [acceptedRecord()], counts: {}, contributors: [] } }),
    ]);
    expect(item.entityState?.financialReadiness).toBe("setup_required");
  });

  it("release records also start payout-unready - GitHub identity alone never grants readiness", () => {
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
    expect(item.entityState?.financialReadiness).toBe("setup_required");
  });
});
