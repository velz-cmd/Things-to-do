import { describe, expect, it } from "vitest";
import { resolveSpendableUsd } from "@/lib/wallet/sync-identity-balance";

describe("resolveSpendableUsd", () => {
  it("uses on-chain balance when available (exchange model)", () => {
    expect(
      resolveSpendableUsd({
        availableUsd: 35,
        onChainUsd: 20,
        reservedUsd: 0,
      }),
    ).toBe(20);
  });

  it("subtracts program reserves from on-chain", () => {
    expect(
      resolveSpendableUsd({
        availableUsd: 100,
        onChainUsd: 50,
        reservedUsd: 5,
      }),
    ).toBe(45);
  });

  it("falls back to ledger when on-chain read fails", () => {
    expect(
      resolveSpendableUsd({
        availableUsd: 12.5,
        onChainUsd: null,
        reservedUsd: 0,
      }),
    ).toBe(12.5);
  });
});
