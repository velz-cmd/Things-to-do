import { describe, expect, it } from "vitest";
import {
  checkSpendAuthority,
  computeBudgetState,
  formatUsdc,
  microToUsd,
  usdToMicro,
  type SpendEntry,
} from "../../src/lib/mission/intelligence-budget";

/**
 * System invariants for Mission spending authority.
 *
 * The budget used to live in localStorage, so it vanished with the browser and
 * two tabs could each believe the whole budget was free. These lock the
 * accounting rules that replaced it.
 */
describe("mission intelligence budget accounting", () => {
  const grantedMicro = usdToMicro(0.5);
  const perPurchaseLimitMicro = usdToMicro(0.1);

  const state = (entries: SpendEntry[]) =>
    computeBudgetState({ grantedMicro, perPurchaseLimitMicro, entries });

  it("uses integer micro-USD so float error cannot decide authority", () => {
    expect(usdToMicro(0.1) + usdToMicro(0.2)).toBe(usdToMicro(0.3));
    expect(usdToMicro(0.003)).toBe(3000);
    expect(microToUsd(3000)).toBeCloseTo(0.003, 9);
  });

  it("counts money in flight as committed, not available", () => {
    // A submitted payment whose confirmation has not arrived still holds
    // budget; otherwise a second purchase could spend the same money.
    const s = state([
      { amountMicro: usdToMicro(0.1), state: "submitted" },
      { amountMicro: usdToMicro(0.1), state: "confirmed" },
    ]);
    expect(s.committedMicro).toBe(usdToMicro(0.2));
    expect(s.availableMicro).toBe(usdToMicro(0.3));
  });

  it("returns budget only when a spend can no longer settle", () => {
    const s = state([
      { amountMicro: usdToMicro(0.1), state: "released" },
      { amountMicro: usdToMicro(0.1), state: "failed" },
    ]);
    expect(s.committedMicro).toBe(0);
    expect(s.availableMicro).toBe(grantedMicro);
  });

  it("refuses a purchase above the per-purchase limit", () => {
    const result = checkSpendAuthority({
      amountMicro: usdToMicro(0.25),
      state: state([]),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("exceeds_per_purchase");
      expect(result.reason).toContain("per-purchase limit");
    }
  });

  it("refuses a purchase that would exceed the remaining budget", () => {
    const spent: SpendEntry[] = [
      { amountMicro: usdToMicro(0.1), state: "confirmed" },
      { amountMicro: usdToMicro(0.1), state: "confirmed" },
      { amountMicro: usdToMicro(0.1), state: "confirmed" },
      { amountMicro: usdToMicro(0.1), state: "confirmed" },
      { amountMicro: usdToMicro(0.05), state: "reserved" },
    ];
    const result = checkSpendAuthority({
      amountMicro: usdToMicro(0.1),
      state: state(spent),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("exceeds_budget");
  });

  it("never lets concurrent reservations jointly overspend", () => {
    // Two runs each see 0.05 available; only one can fit a 0.05 purchase, and
    // the second must be refused once the first is committed.
    let entries: SpendEntry[] = [
      { amountMicro: usdToMicro(0.45), state: "confirmed" },
    ];
    const first = checkSpendAuthority({
      amountMicro: usdToMicro(0.05),
      state: state(entries),
    });
    expect(first.ok).toBe(true);
    entries = [...entries, { amountMicro: usdToMicro(0.05), state: "reserved" }];
    const second = checkSpendAuthority({
      amountMicro: usdToMicro(0.05),
      state: state(entries),
    });
    expect(second.ok).toBe(false);
  });

  it("treats a zero budget as no authority, never unlimited", () => {
    const zero = computeBudgetState({
      grantedMicro: 0,
      perPurchaseLimitMicro: 0,
      entries: [],
    });
    expect(zero.availableMicro).toBe(0);
    const result = checkSpendAuthority({ amountMicro: 1000, state: zero });
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive and non-integer amounts", () => {
    const s = state([]);
    for (const amount of [0, -1000, 1.5]) {
      const result = checkSpendAuthority({ amountMicro: amount, state: s });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("invalid_amount");
    }
  });

  it("explains exhaustion in money terms a person can act on", () => {
    const exhausted = state([
      { amountMicro: usdToMicro(0.5), state: "confirmed" },
    ]);
    const result = checkSpendAuthority({
      amountMicro: usdToMicro(0.05),
      state: exhausted,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("0.05 USDC");
      expect(result.reason).toContain("0.5 USDC");
    }
  });

  it("never renders a real charge as zero", () => {
    expect(formatUsdc(3000)).toBe("0.003 USDC");
    expect(formatUsdc(usdToMicro(5))).toBe("5 USDC");
    expect(formatUsdc(0)).toBe("0 USDC");
  });
});

describe("kill switch overrides everything else", () => {
  it("refuses a spend within budget once revoked", () => {
    const state = computeBudgetState({
      grantedMicro: usdToMicro(0.5),
      perPurchaseLimitMicro: usdToMicro(0.1),
      entries: [],
      revoked: true,
    });
    const result = checkSpendAuthority({ amountMicro: usdToMicro(0.05), state });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("revoked");
  });

  it("checks revocation before amount validity, so the reason is never ambiguous", () => {
    const state = computeBudgetState({
      grantedMicro: usdToMicro(0.5),
      perPurchaseLimitMicro: usdToMicro(0.1),
      entries: [],
      revoked: true,
    });
    // Even an invalid amount reports "revoked" first - the fact that made
    // this Mission unable to spend at all outranks a malformed request.
    const result = checkSpendAuthority({ amountMicro: -1, state });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("revoked");
  });

  it("does not revoke by default", () => {
    const state = computeBudgetState({
      grantedMicro: usdToMicro(0.5),
      perPurchaseLimitMicro: usdToMicro(0.1),
      entries: [],
    });
    expect(state.revoked).toBe(false);
  });
});
