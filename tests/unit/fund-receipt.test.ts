import { describe, expect, it } from "vitest";
import { receiptKindCopy } from "../../src/lib/receipt/copy";

describe("receiptKindCopy", () => {
  it("includes contribution kind for fund_program activity receipts", () => {
    const copy = receiptKindCopy("contribution");
    expect(copy.badge).toBe("Pool contribution");
    expect(copy.title).toContain("Funding");
  });
});
