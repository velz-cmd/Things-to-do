import { describe, expect, it } from "vitest";
import {
  circleIdempotencyKey,
  isUuidV4,
} from "@/lib/wallet/circle-idempotency";

describe("circleIdempotencyKey", () => {
  it("passes through valid UUID v4 user ids", () => {
    const userId = "1a9747e5-32ee-4f51-ab6e-1562ee3bb88b";
    expect(circleIdempotencyKey(userId)).toBe(userId);
    expect(isUuidV4(userId)).toBe(true);
  });

  it("derives stable UUID v4 from arbitrary seeds", () => {
    const a = circleIdempotencyKey("agent-signal:task1:docs-review");
    const b = circleIdempotencyKey("agent-signal:task1:docs-review");
    expect(a).toBe(b);
    expect(isUuidV4(a)).toBe(true);
  });

  it("does not use legacy prefixed keys rejected by Circle", () => {
    const userId = "1a9747e5-32ee-4f51-ab6e-1562ee3bb88b";
    const legacy = `resolve-app-wallet-${userId}`;
    expect(isUuidV4(legacy)).toBe(false);
    expect(circleIdempotencyKey(userId)).not.toBe(legacy);
  });
});
