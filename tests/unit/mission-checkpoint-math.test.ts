import { describe, expect, it } from "vitest";
import {
  computeFundCheckpointLabel,
  formatAgentAttributionLine,
} from "../../src/lib/mission/mission-checkpoint-math";

describe("mission-checkpoint-math", () => {
  it("formats fund checkpoint label", () => {
    const { label, clearedCount } = computeFundCheckpointLabel({
      fundUsd: 500,
      payees: [
        { label: "a", owedUsd: 100, source: "ledger" },
        { label: "b", owedUsd: 200, source: "ledger" },
      ],
      poolBalanceUsd: 100,
      milestoneUsd: 500,
    });
    expect(clearedCount).toBe(2);
    expect(label).toContain("Fund $500");
    expect(label).toContain("2 authorizations clear");
  });

  it("formats agent attribution line", () => {
    const line = formatAgentAttributionLine(0.02, 10, 500, (n) => `$${n.toFixed(2)}`);
    expect(line).toBe("$0.02 → 10 payees → $500 package");
  });
});
