import { describe, expect, it } from "vitest";
import { computePoolMilestoneSegment } from "../../src/lib/capital/pool-milestone-progress";

describe("communal pool milestone", () => {
  it("combines deposits toward the same checkpoint bar", () => {
    const alice = 120;
    const bob = 80;
    const combined = alice + bob;
    const seg = computePoolMilestoneSegment(combined);
    expect(seg.poolUsd).toBe(200);
    expect(seg.progressPct).toBe(40);
    expect(seg.ceilingUsd).toBe(500);
  });
});
