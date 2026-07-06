import { describe, expect, it } from "vitest";
import {
  activityLabelWithCircleTx,
  circleTxIdFromActivityLabel,
  stakeIdFromActivityLabel,
} from "../../src/lib/capital/fund-pending-label";

describe("fund-pending-label", () => {
  it("round-trips circle tx and stake ids in activity labels", () => {
    const label = activityLabelWithCircleTx(
      "You funded React docs",
      "circle-tx-abc",
      "stake-123",
    );
    expect(circleTxIdFromActivityLabel(label)).toBe("circle-tx-abc");
    expect(stakeIdFromActivityLabel(label)).toBe("stake-123");
  });
});
