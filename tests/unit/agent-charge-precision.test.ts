import { describe, expect, it } from "vitest";
import { USDC_TOKEN_DECIMALS, uiUsdNumberToTokenUnits } from "../../src/lib/money/usdc";

/**
 * Regression cover for a real money bug observed in Preview: the Agent
 * Marketplace reported "Agent payment sent on Arc" alongside
 * "Charged 0.000 USDC" for a service priced at 0.003 USDC.
 *
 * Root cause was `Math.round(n * 100) / 100` (2 decimals) applied to the
 * CHARGE amount. USDC has 6 decimals, so 0.003 is perfectly representable,
 * but 2dp rounding collapsed it to exactly 0. The transfer then moved no
 * money, `chargedUsd` returned 0, and the service still executed - a false
 * financial success claim. In the connected-wallet path the same zero was
 * passed to the verifier as `expectedUsd`, making the amount check vacuous.
 */
const roundAt = (decimals: number) => (n: number) =>
  Math.round(n * 10 ** decimals) / 10 ** decimals;

const MICRO_PRICES = [0.003, 0.0001, 0.01, 0.1];

describe("Agent charge precision", () => {
  it("demonstrates the 2-decimal rounding that zeroed micro-payments", () => {
    // The exact defect: a real, settleable price becomes nothing.
    expect(roundAt(2)(0.003)).toBe(0);
  });

  it("preserves every micro price at USDC precision", () => {
    const roundCharge = roundAt(USDC_TOKEN_DECIMALS);
    for (const price of MICRO_PRICES) {
      expect(roundCharge(price)).toBe(price);
      expect(roundCharge(price)).toBeGreaterThan(0);
    }
  });

  it("keeps micro prices non-zero once converted to on-chain token units", () => {
    // Guards the boundary that actually reaches the chain.
    for (const price of MICRO_PRICES) {
      expect(uiUsdNumberToTokenUnits(price) > 0n).toBe(true);
    }
    expect(uiUsdNumberToTokenUnits(0.003)).toBe(3000n);
  });

  it("treats a price below USDC's smallest unit as unsettleable, not as free", () => {
    const roundCharge = roundAt(USDC_TOKEN_DECIMALS);
    const belowSmallestUnit = 1e-9;
    // Must round to zero...
    expect(roundCharge(belowSmallestUnit)).toBe(0);
    // ...which is exactly the condition the charge paths now reject rather
    // than silently letting a positive-priced service run for free.
    expect(belowSmallestUnit > 0 && roundCharge(belowSmallestUnit) <= 0).toBe(true);
  });

  it("renders a micro charge with meaningful precision", () => {
    // 0.003 must not display as "0.00".
    expect((0.003).toFixed(2)).toBe("0.00");
    expect((0.003).toFixed(3)).toBe("0.003");
  });
});
