import { describe, expect, it } from "vitest";
import {
  buildMaintainerConcentration,
  buildProgramCoverage,
  buildRecognitionDebt,
  diffRepositorySnapshots,
  inferProgramCategories,
} from "../../src/lib/discover/oss-intelligence";
import type { FundingOpportunity, GitHubWorkCategory } from "../../src/lib/github/types";

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

describe("Discover open-source intelligence", () => {
  it("does not call a category without activity a recognition gap", () => {
    const current = opportunity([{ id: "1", category: "documentation", actor: "ada" }]);
    const programs = [{ id: "docs", name: "Docs bounty", status: "active", categories: ["documentation" as const] }];
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
});
