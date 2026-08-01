import { describe, expect, it } from "vitest";
import { buildPayoutOwnershipMessage } from "@/lib/profile/payout-ownership-proof";

describe("payout ownership proof", () => {
  it("binds the normalized payout address and request nonce", () => {
    expect(
      buildPayoutOwnershipMessage(
        "0xdD200b8Fe8F6C15112b18EF6E49572f8a1e03A84",
        "request-12345678",
      ),
    ).toBe(
      "RESOLVE payout destination\n" +
        "Address: 0xdd200b8fe8f6c15112b18ef6e49572f8a1e03a84\n" +
        "Nonce: request-12345678",
    );
  });
});
