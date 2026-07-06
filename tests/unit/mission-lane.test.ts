import { describe, expect, it } from "vitest";
import { missionProofStages } from "../../src/lib/mission/mission-proof-stages";

describe("missionProofStages", () => {
  it("marks observe active at mission start", () => {
    const stages = missionProofStages({ missionPhase: "discover", loopPhase: "observe" });
    expect(stages[0]?.active).toBe(true);
    expect(stages[2]?.done).toBe(false);
  });

  it("marks settle done in execute phase", () => {
    const stages = missionProofStages({
      missionPhase: "execute",
      loopPhase: "settle",
      hasPool: true,
      hasAllocation: true,
    });
    expect(stages[2]?.done).toBe(true);
  });
});
