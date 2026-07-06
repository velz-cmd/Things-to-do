import { describe, expect, it } from "vitest";
import { applyCommunalTotals, viewerStakeTotals } from "../../src/lib/capital/community-pool-math";
import type { ProgramPoolState } from "../../src/lib/capital/pool-checkpoint-types";

describe("community-pool-aggregate", () => {
  it("sums viewer deposits across programs in one community", () => {
    const totals = viewerStakeTotals(
      [
        { userId: "u1", programId: "p1", principalUsd: 90, releasedUsd: 0, status: "active" },
        { userId: "u2", programId: "p2", principalUsd: 30, releasedUsd: 0, status: "active" },
      ],
      "u1",
    );
    expect(totals.yourDepositUsd).toBe(90);
  });

  it("overlays communal totals onto base pool state", () => {
    const base = {
      poolBalanceUsd: 30,
      totalDepositedUsd: 30,
      funderCount: 1,
      owedToCreatorsUsd: 100,
      funder: { yourDepositUsd: 30, yourSharePct: 100, yourReleasedUsd: 0, estimatedShareOfOwedUsd: 100, projectedImpactUsd: 0, userId: "u2" },
    } as ProgramPoolState;

    const merged = applyCommunalTotals(
      base,
      {
        programIds: ["p1", "p2"],
        stakes: [
          { userId: "u1", programId: "p1", principalUsd: 90, releasedUsd: 0, status: "active" },
          { userId: "u2", programId: "p2", principalUsd: 30, releasedUsd: 0, status: "active" },
        ],
        totalDepositedUsd: 120,
        releasedUsd: 0,
        availableUsd: 120,
        funderCount: 2,
        canonicalProgramId: "p1",
      },
      "u2",
    );

    expect(merged.poolBalanceUsd).toBe(120);
    expect(merged.funderCount).toBe(2);
    expect(merged.funder.yourDepositUsd).toBe(30);
    expect(merged.funder.yourSharePct).toBe(25);
  });
});
