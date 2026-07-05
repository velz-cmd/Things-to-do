import { describe, expect, it } from "vitest";
import {
  computePoolMilestoneSegment,
  PRIMARY_POOL_MILESTONES_USD,
} from "../../src/lib/capital/pool-milestone-progress";

describe("computePoolMilestoneSegment", () => {
  it("tracks $0 → $500 on first milestone", () => {
    const seg = computePoolMilestoneSegment(125, PRIMARY_POOL_MILESTONES_USD);
    expect(seg.floorUsd).toBe(0);
    expect(seg.ceilingUsd).toBe(500);
    expect(seg.progressPct).toBe(25);
  });

  it("tracks $500 → $2500 after first milestone completes", () => {
    const seg = computePoolMilestoneSegment(750, PRIMARY_POOL_MILESTONES_USD);
    expect(seg.floorUsd).toBe(500);
    expect(seg.ceilingUsd).toBe(2500);
    expect(seg.progressPct).toBe(13);
  });
});
