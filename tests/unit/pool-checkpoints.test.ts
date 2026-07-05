import { describe, expect, it } from "vitest";
import {
  payeeCategoryForTemplate,
  resolveCheckpointThresholds,
  DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD,
} from "@/lib/capital/pool-checkpoint-defaults";

describe("pool checkpoint defaults", () => {
  it("includes 500 USD milestone", () => {
    expect(DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD).toContain(500);
  });

  it("uses custom thresholds when set", () => {
    expect(resolveCheckpointThresholds({ checkpointThresholdsUsd: [5, 500] })).toEqual([
      5, 500,
    ]);
  });

  it("labels payee category by template", () => {
    expect(payeeCategoryForTemplate("user-centric-royalties")).toBe("artists");
    expect(payeeCategoryForTemplate("docs-bounty")).toBe("maintainers");
  });
});
