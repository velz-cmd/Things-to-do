import { describe, expect, it } from "vitest";
import {
  affordableFundingSources,
  defaultFundingSource,
  pickFundingSource,
} from "../../src/lib/wallet/funding-source";

describe("funding-source", () => {
  const balances = { appSpendableUsd: 50, externalSpendableUsd: 20 };

  it("prefers connected wallet when both can pay", () => {
    expect(affordableFundingSources(5, balances, true)).toEqual(["external", "app"]);
    expect(defaultFundingSource(5, balances, true)).toBe("external");
    expect(pickFundingSource(5, balances, true)).toBe("external");
  });

  it("uses RESOLVE wallet when external cannot pay", () => {
    expect(pickFundingSource(25, balances, true)).toBe("app");
  });

  it("uses connected wallet when only external can pay", () => {
    const lowApp = { appSpendableUsd: 1, externalSpendableUsd: 30 };
    expect(pickFundingSource(5, lowApp, true)).toBe("external");
  });
});
