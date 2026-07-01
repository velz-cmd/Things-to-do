import { describe, expect, it } from "vitest";
import { parseUsdFromReceiptText } from "../../src/lib/deputy/tools/parse-receipt-amount";

describe("parseUsdFromReceiptText", () => {
  it("parses dollar amounts from receipt snippets", () => {
    expect(parseUsdFromReceiptText("Your total is $43.00 — thank you")).toBe(43);
    expect(parseUsdFromReceiptText("Amount USD 12.99 charged")).toBe(12.99);
    expect(parseUsdFromReceiptText("no money here")).toBeNull();
  });
});
