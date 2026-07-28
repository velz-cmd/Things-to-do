import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "@/lib/discover/fetch-timeout";

describe("Discover deadlines", () => {
  it("returns the degraded fallback when a source never resolves", async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const result = withTimeout(pending, 3_500, "degraded");

    await vi.advanceTimersByTimeAsync(3_500);

    await expect(result).resolves.toBe("degraded");
    vi.useRealTimers();
  });

  it("preserves a response that completes inside the deadline", async () => {
    await expect(withTimeout(Promise.resolve("live"), 3_500, "degraded")).resolves.toBe(
      "live",
    );
  });
});
