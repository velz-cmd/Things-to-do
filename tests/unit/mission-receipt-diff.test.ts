import { describe, expect, it } from "vitest";
import { diffMissionReceipts } from "../../src/lib/mission/mission-receipt-diff";
import type { MissionReportRecord } from "../../src/lib/mission/mission-report-store";

function mockReport(overrides: Partial<MissionReportRecord>): MissionReportRecord {
  return {
    id: "mbp-1",
    objective: "Fund React",
    communitySlug: "react",
    communityLabel: "React",
    totalCapitalUsd: 500,
    milestoneUsd: 500,
    payees: [{ label: "a", owedUsd: 100, source: "ledger" }],
    agentSignalUsd: 0,
    agentHeadline: "",
    findings: [],
    recommendations: [],
    authorizationCount: 1,
    confidence: 0.9,
    rationale: "",
    status: "authorized",
    createdAt: new Date().toISOString(),
    policy: "balanced",
    ...overrides,
  };
}

describe("mission-receipt-diff", () => {
  it("detects payee and policy changes", () => {
    const before = mockReport({ policy: "balanced" });
    const after = mockReport({
      policy: "growth",
      payees: [
        { label: "a", owedUsd: 120, source: "ledger" },
        { label: "b", owedUsd: 80, source: "ledger" },
      ],
      totalCapitalUsd: 600,
    });
    const diff = diffMissionReceipts(before, after);
    expect(diff.policyChanged).toBe(true);
    expect(diff.payeesAdded).toContain("b");
    expect(diff.budgetDeltaUsd).toBe(100);
  });
});
