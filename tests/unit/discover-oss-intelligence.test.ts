import { describe, expect, it } from "vitest";
import {
  buildMaintainerConcentration,
  buildDiscoverPoolOperation,
  buildProgramCoverage,
  buildRecognitionDebt,
  diffRepositorySnapshots,
  inferProgramCategories,
} from "../../src/lib/discover/oss-intelligence";
import type { DiscoverProgramSummary } from "../../src/lib/discover/oss-intelligence";
import type { FundingOpportunity, GitHubWorkCategory } from "../../src/lib/github/types";
import type { ProgramPoolState } from "../../src/lib/capital/pool-checkpoint-types";

function opportunity(records: Array<{ id: string; category: GitHubWorkCategory; actor: string }>, gap = 1200): FundingOpportunity {
  const counts = { code: 0, review: 0, documentation: 0, issue_resolution: 0, release_work: 0, support: 0, security: 0 };
  records.forEach((record) => { counts[record.category] += 1; });
  return {
    id: "opp-acme-tool", owner: "acme", repo: "tool", fullName: "acme/tool", stars: 100, forks: 20,
    health: { score: 70, grade: "B", signals: [], maintainerCount: 2, fundingGapUsd: gap, headline: "Healthy" },
    unfundedMaintainers: 0, highImpactPrs: 1, headline: "Healthy", priority: "medium", live: true,
    activity: {
      observedAt: "2026-07-18T00:00:00.000Z", rangeStart: "2026-07-10T00:00:00.000Z", rangeEnd: "2026-07-18T00:00:00.000Z",
      counts,
      records: records.map((record) => ({ ...record, title: record.id, occurredAt: "2026-07-17T00:00:00.000Z", sourceUrl: `https://github.com/acme/tool/pull/${record.id}`, sourceKind: record.category === "review" ? "review" : "pull_request" })),
      contributors: [],
    },
  };
}

function program(overrides: Partial<DiscoverProgramSummary> = {}): DiscoverProgramSummary {
  return {
    id: "docs",
    name: "Docs bounty",
    status: "active",
    categories: ["documentation"],
    programVersionId: "program-version-1",
    policyVersionId: "policy-version-1",
    policyVersion: 3,
    retroactiveMode: false,
    dependencySupportPercent: 0,
    matchingMode: false,
    ...overrides,
  };
}

describe("Discover open-source intelligence", () => {
  it("does not call a category without activity a recognition gap", () => {
    const current = opportunity([{ id: "1", category: "documentation", actor: "ada" }]);
    const programs = [program()];
    const coverage = buildProgramCoverage(current, programs);
    expect(coverage.find((row) => row.category === "documentation")?.status).toBe("covered");
    expect(coverage.find((row) => row.category === "security")?.status).toBe("no_activity");
    expect(buildRecognitionDebt(current, coverage)).toHaveLength(0);
  });

  it("reports recognition debt only for proof-linked accepted work without policy", () => {
    const current = opportunity([{ id: "1", category: "review", actor: "ada" }]);
    const coverage = buildProgramCoverage(current, []);
    const debt = buildRecognitionDebt(current, coverage);
    expect(debt).toHaveLength(1);
    expect(debt[0]?.sourceUrl).toMatch(/^https:\/\/github\.com\//);
  });

  it("shows the exact numerator and denominator for top-two concentration", () => {
    const current = opportunity([
      { id: "1", category: "review", actor: "ada" },
      { id: "2", category: "review", actor: "ada" },
      { id: "3", category: "review", actor: "grace" },
      { id: "4", category: "review", actor: "lin" },
    ]);
    const review = buildMaintainerConcentration(current).find((row) => row.category === "review");
    expect(review).toMatchObject({ total: 4, topTwoCount: 3, topTwoSharePct: 75 });
    expect(review?.statement).toContain("3 of 4");
  });

  it("diffs immutable repository snapshots without manufacturing change", () => {
    const previous = opportunity([{ id: "1", category: "code", actor: "ada" }], 1000);
    const current = opportunity([{ id: "1", category: "code", actor: "ada" }, { id: "2", category: "review", actor: "grace" }], 1200);
    const rows = diffRepositorySnapshots(current, previous);
    expect(rows.find((row) => row.key === "accepted")?.delta).toBe(1);
    expect(rows.find((row) => row.key === "funding-gap")?.delta).toBe(200);
    expect(diffRepositorySnapshots(current, null).every((row) => row.delta === null)).toBe(true);
  });

  it("infers only categories stated by the active policy material", () => {
    expect(inferProgramCategories({ templateId: "docs-bounty", name: "Docs", rules: {}, evidenceRule: { eventType: "documentation_merged" } })).toEqual(["documentation"]);
  });

  it("maps only persisted pool and authorization values into the allocation desk", () => {
    const pool: ProgramPoolState = {
      programId: "docs", programName: "Docs bounty", communitySlug: "acme", templateId: "docs-bounty", payeeCategory: "writers",
      poolBalanceUsd: 320, totalDepositedUsd: 320, releasedUsd: 40, availableUsd: 280,
      owedToCreatorsUsd: 175, settledUsd: 40, claimableUsd: 25,
      funderCount: 3, contributorCount: 8, authorizationCount: 6,
      sourcedHook: "$175.00 is recognized across 6 authorizations backed by $280.00 available capital.",
      checkpoints: [], nextCheckpointUsd: 500, progressToNextPct: 64,
      recentBatches: [{ id: "batch-1", settledUsd: 40, payeeCount: 2, at: "2026-07-17T00:00:00.000Z", checkpointThresholdUsd: 250 }],
      autoSettleEnabled: true,
      funder: { userId: null, yourDepositUsd: 0, yourSharePct: 0, yourReleasedUsd: 0, estimatedShareOfOwedUsd: 0, projectedImpactUsd: 0 },
      nextBatchPayees: [{ label: "@ada", owedUsd: 100, payeeKey: "ada", payeeKeyType: "github" }],
      nextBatchTotalUsd: 100, activeMilestoneUsd: 500,
    };
    const row = buildDiscoverPoolOperation(pool, program({
      retroactiveMode: true,
      dependencySupportPercent: 7.5,
      matchingMode: true,
    }));
    expect(row).toMatchObject({
      poolBalanceUsd: 320,
      availableUsd: 280,
      recognizedOwedUsd: 175,
      remainingToCheckpointUsd: 180,
      queuedTotalUsd: 100,
      policyCoverage: ["Documentation"],
      policyVersion: 3,
      retroactiveMode: true,
      dependencySupportPercent: 7.5,
      matchingMode: true,
    });
    expect(row.queuedPayees).toEqual([{ label: "@ada", owedUsd: 100 }]);
    expect(row.fundingHref).toContain("program=docs");
    expect(row.milestoneConditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "funding", met: false }),
      expect.objectContaining({ id: "obligations", met: true }),
      expect.objectContaining({ id: "recipients", met: true }),
      expect.objectContaining({ id: "policy", met: true }),
    ]));
    expect(row.distributionState).toBe("confirmed");
  });

  it("clamps checkpoint progress and never invents a remaining target", () => {
    const pool = {
      programId: "code", programName: "Merged code", communitySlug: "acme", templateId: "code", payeeCategory: "contributors",
      poolBalanceUsd: 900, totalDepositedUsd: 900, releasedUsd: 0, availableUsd: 900,
      owedToCreatorsUsd: 0, settledUsd: 0, claimableUsd: 0, funderCount: 1, contributorCount: 0, authorizationCount: 0,
      sourcedHook: "No authorization is currently owed.", checkpoints: [], nextCheckpointUsd: null, progressToNextPct: 140,
      recentBatches: [], autoSettleEnabled: false,
      funder: { userId: null, yourDepositUsd: 0, yourSharePct: 0, yourReleasedUsd: 0, estimatedShareOfOwedUsd: 0, projectedImpactUsd: 0 },
      nextBatchPayees: [], nextBatchTotalUsd: 0, activeMilestoneUsd: 900,
    } satisfies ProgramPoolState;
    const row = buildDiscoverPoolOperation(pool, program({ id: "code", name: "Merged code", categories: ["code"] }));
    expect(row.progressToNextPct).toBe(100);
    expect(row.remainingToCheckpointUsd).toBe(0);
    expect(row.nextCheckpointUsd).toBeNull();
  });
});
