import { describe, expect, it } from "vitest";
import { computePoolMilestoneSegment } from "../../src/lib/capital/pool-milestone-progress";

/**
 * Capital that settled on Arc must be distinguishable from capital that was
 * only recorded. Four confirmed 5 USDC deposits displayed as "0 USDC
 * confirmed" because the stake had nowhere to store its transaction hash.
 */
describe("pool checkpoint progress", () => {
  it("measures progress toward a real checkpoint, not a moving budget", () => {
    // 20 USDC confirmed against the first 500 USDC milestone.
    const segment = computePoolMilestoneSegment(20);
    expect(segment.ceilingUsd).toBe(500);
    expect(segment.progressPct).toBeGreaterThan(0);
    expect(segment.progressPct).toBeLessThan(100);
  });

  it("advances the ceiling only once a milestone is actually passed", () => {
    expect(computePoolMilestoneSegment(499).ceilingUsd).toBe(500);
    expect(computePoolMilestoneSegment(501).ceilingUsd).toBe(2500);
  });

  it("never reports negative progress for an empty pool", () => {
    const segment = computePoolMilestoneSegment(0);
    expect(segment.progressPct).toBeGreaterThanOrEqual(0);
  });

  it("does not let a deposit move the finish line", () => {
    // The bug: budgetUsd incremented on every deposit, so the denominator
    // grew with the numerator and the bar could never fill.
    const before = computePoolMilestoneSegment(20);
    const after = computePoolMilestoneSegment(25);
    expect(after.ceilingUsd).toBe(before.ceilingUsd);
    expect(after.progressPct).toBeGreaterThan(before.progressPct);
  });
});
