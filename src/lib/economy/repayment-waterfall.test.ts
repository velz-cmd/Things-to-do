import { describe, expect, it } from "vitest";
import { simulateRepaymentWaterfall } from "./repayment-waterfall";

describe("simulateRepaymentWaterfall", () => {
  it("repays funders from inflows until cap", () => {
    const result = simulateRepaymentWaterfall({
      principalUsd: 1000,
      immediateCreatorPayoutUsd: 850,
      futureInflowsUsd: [500, 500, 500],
    });

    expect(result.creatorsPaidUsd).toBe(850);
    expect(result.funderRepaidUsd).toBeGreaterThan(0);
    expect(result.funderRepaidUsd).toBeLessThanOrEqual(1500);
    expect(result.ledger.length).toBe(3);
  });

  it("routes surplus to community after cap", () => {
    const result = simulateRepaymentWaterfall({
      principalUsd: 100,
      immediateCreatorPayoutUsd: 80,
      futureInflowsUsd: [10_000],
    });

    expect(result.capReached).toBe(true);
    expect(result.communitySurplusUsd).toBeGreaterThan(0);
  });
});
