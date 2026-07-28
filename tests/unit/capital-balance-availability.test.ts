import { describe, expect, it } from "vitest";
import { capitalBalanceUnavailable } from "@/lib/capital/balance-availability";

describe("Capital balance availability", () => {
  it("does not turn a missing selected-wallet snapshot into zero", () => {
    expect(
      capitalBalanceUnavailable({
        syncStatus: "cached",
        networkHealth: "unknown",
        selectedBalancePresent: false,
      }),
    ).toBe(true);
  });

  it("keeps a confirmed cached selected-wallet balance available", () => {
    expect(
      capitalBalanceUnavailable({
        syncStatus: "cached",
        networkHealth: "degraded",
        selectedBalancePresent: true,
      }),
    ).toBe(false);
  });

  it("marks provider failure unavailable even when an old slice is present", () => {
    expect(
      capitalBalanceUnavailable({
        syncStatus: "error",
        networkHealth: "unavailable",
        selectedBalancePresent: true,
      }),
    ).toBe(true);
  });
});
