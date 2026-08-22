import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache/kv", () => ({
  cacheGetOrSetResilient: vi.fn((_key: string, _ttl: number, factory: () => Promise<unknown>) =>
    factory(),
  ),
}));
vi.mock("@/lib/integrations/npm-registry", () => ({
  fetchRepoNpmUsage: vi.fn(),
}));
vi.mock("@/lib/integrations/docker-hub", () => ({
  fetchDockerUsageForGithubRepo: vi.fn(),
}));

import { fetchRepoNpmUsage } from "@/lib/integrations/npm-registry";
import { fetchDockerUsageForGithubRepo } from "@/lib/integrations/docker-hub";
import { attachNpmDockerAdoption } from "@/lib/discover/marketplace/npm-docker-adoption";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

const mockedNpm = vi.mocked(fetchRepoNpmUsage);
const mockedDocker = vi.mocked(fetchDockerUsageForGithubRepo);

function work(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "github-work:1",
    slug: "work-1",
    title: "Fix bug",
    summary: "",
    description: "",
    type: "repository_fix",
    status: "verified",
    creator: { type: "individual", name: "dev", verified: true },
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

describe("attachNpmDockerAdoption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves items unchanged when neither connector observes anything", async () => {
    mockedNpm.mockResolvedValueOnce(null);
    mockedDocker.mockResolvedValueOnce(null);
    const [item] = await attachNpmDockerAdoption([work()]);
    expect(item.impactProfile).toEqual({ measurable: false, reason: "not yet measurable" });
  });

  it("adds a real npm downloads signal, scoped to repository", async () => {
    mockedNpm.mockResolvedValueOnce({
      packageName: "widgets",
      downloadsLastMonth: 50_000,
      downloadsLastWeek: 12_000,
    });
    mockedDocker.mockResolvedValueOnce(null);
    const [item] = await attachNpmDockerAdoption([work()]);
    expect(item.impactProfile?.measurable).toBe(true);
    if (item.impactProfile?.measurable) {
      expect(item.impactProfile.signals).toEqual([
        expect.objectContaining({
          id: "npm_downloads_last_month",
          scope: "repository",
          source: "npm registry",
          value: "50,000",
        }),
      ]);
    }
  });

  it("adds both npm and docker signals when both connectors observe real usage", async () => {
    mockedNpm.mockResolvedValueOnce({
      packageName: "widgets",
      downloadsLastMonth: 1000,
      downloadsLastWeek: 200,
    });
    mockedDocker.mockResolvedValueOnce({
      namespace: "acme",
      repository: "widgets",
      pullCount: 900_000,
      starCount: 10,
    });
    const [item] = await attachNpmDockerAdoption([work()]);
    expect(item.impactProfile?.measurable).toBe(true);
    if (item.impactProfile?.measurable) {
      expect(item.impactProfile.signals.map((s) => s.id).sort()).toEqual([
        "docker_pulls",
        "npm_downloads_last_month",
      ]);
    }
  });

  it("does not re-query items that already have a measurable impact profile", async () => {
    const already = work({
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "dependent_repositories",
            label: "Dependent repositories",
            value: "12",
            scope: "repository",
            source: "Libraries.io",
            observedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
    });
    const [item] = await attachNpmDockerAdoption([already]);
    expect(mockedNpm).not.toHaveBeenCalled();
    expect(mockedDocker).not.toHaveBeenCalled();
    expect(item.impactProfile).toEqual(already.impactProfile);
  });

  it("skips items with no repository or non-github sources", async () => {
    const nonGithub = work({ source: { type: "open_collective_contribution", id: "x" }, repository: undefined });
    const result = await attachNpmDockerAdoption([nonGithub]);
    expect(mockedNpm).not.toHaveBeenCalled();
    expect(result[0]).toBe(nonGithub);
  });
});
