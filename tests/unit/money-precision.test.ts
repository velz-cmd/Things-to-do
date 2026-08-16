import { describe, expect, it } from "vitest";
import { formatMoney } from "../../src/components/resolve/ui/money";

describe("money formatting never hides a real payment", () => {
  it("shows a sub-cent agent charge at its real value", () => {
    // Proven on Arc: 3000000000000000 wei = 0.003 USDC was actually charged,
    // and the receipt rendered "$0.00".
    expect(formatMoney(0.003)).toBe("$0.003");
  });

  it("never renders a non-zero amount as zero", () => {
    for (const amount of [0.003, 0.001, 0.0004, 0.009999]) {
      expect(formatMoney(amount)).not.toBe("$0.00");
    }
  });

  it("keeps two decimals for ordinary amounts", () => {
    expect(formatMoney(5)).toBe("$5.00");
    expect(formatMoney(64.92)).toBe("$64.92");
    expect(formatMoney(0.01)).toBe("$0.01");
  });

  it("trims trailing zeros rather than padding noise", () => {
    expect(formatMoney(0.0005)).toBe("$0.0005");
  });

  it("treats a genuine zero as zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("does not crash on non-finite input", () => {
    expect(formatMoney(Number.NaN)).toBe("$0.00");
  });
});
