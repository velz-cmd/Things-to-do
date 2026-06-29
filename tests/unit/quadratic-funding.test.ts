/** Quadratic funding math tests */

import { describe, expect, it } from "vitest";
import {
  allocateMatchPool,
  computeMatchLeverage,
  computeQfScores,
} from "@/lib/capital/quadratic-funding";

describe("quadratic-funding", () => {
  it("allocates match pool proportionally to QF scores", () => {
    const contributions = [
      { projectKey: "a", contributorKey: "u1", amountUsd: 100 },
      { projectKey: "a", contributorKey: "u2", amountUsd: 25 },
      { projectKey: "b", contributorKey: "u3", amountUsd: 50 },
    ];
    const scores = computeQfScores(contributions);
    const allocations = allocateMatchPool(scores, 1000);
    const total = allocations.reduce((s, a) => s + a.matchUsd, 0);
    expect(total).toBeCloseTo(1000, 0);
    const projectA = allocations.find((a) => a.projectKey === "a");
    const projectB = allocations.find((a) => a.projectKey === "b");
    expect(projectA!.matchUsd).toBeGreaterThan(projectB!.matchUsd);
  });

  it("computes match leverage toward 2× target", () => {
    const result = computeMatchLeverage({
      communityContributionsUsd: 1500,
      matchDistributedUsd: 500,
      matchPoolFundedUsd: 1000,
    });
    expect(result.leverage).toBe(2);
    expect(result.targetMet).toBe(true);
  });
});
