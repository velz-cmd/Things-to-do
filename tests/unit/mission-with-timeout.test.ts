import { describe, expect, it } from "vitest";
import { withTimeout } from "../../src/lib/mission/with-timeout";

describe("withTimeout", () => {
  it("resolves when promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 500, "test")).resolves.toBe(42);
  });

  it("rejects when promise exceeds deadline", async () => {
    await expect(
      withTimeout(new Promise((resolve) => setTimeout(() => resolve(1), 50)), 10, "slow"),
    ).rejects.toThrow(/timed out/i);
  });
});
