import { describe, expect, it } from "vitest";
import { classifySourceHealth, describeSourceHealth } from "@/lib/discover/marketplace/source-health";

describe("classifySourceHealth", () => {
  it("is healthy when the last attempt succeeded", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-22T00:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:00:00.000Z",
      lastAttemptSucceeded: true,
    });
    expect(state.status).toBe("healthy");
    expect(describeSourceHealth(state)).toBe("Live");
  });

  it("is unavailable when no successful observation has ever occurred", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: null,
      lastAttemptAt: "2026-08-22T00:00:00.000Z",
      lastAttemptSucceeded: false,
    });
    expect(state.status).toBe("unavailable");
    expect(describeSourceHealth(state)).toBe("Source unavailable. No confirmed observation yet.");
  });

  it("is stale when a recent attempt failed but the confirmed value is under the unavailable threshold", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-21T12:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:00:00.000Z", // 12h later
      lastAttemptSucceeded: false,
    });
    expect(state.status).toBe("stale");
    expect(describeSourceHealth(state)).toBe("Last confirmed 12h ago.");
  });

  it("is unavailable when the confirmed value is far too old", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-15T00:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:00:00.000Z", // 7 days later
      lastAttemptSucceeded: false,
    });
    expect(state.status).toBe("unavailable");
    expect(describeSourceHealth(state)).toContain("Source unavailable");
  });

  it("prefers rate_limited when explicitly signaled, regardless of freshness", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-22T00:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:00:00.000Z",
      lastAttemptSucceeded: false,
      rateLimited: true,
    });
    expect(state.status).toBe("rate_limited");
  });

  it("never includes raw HTTP/exception detail in its user-facing description", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-21T00:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:00:00.000Z",
      lastAttemptSucceeded: false,
      reason: "connect ECONNRESET 10.0.0.1:443",
    });
    const description = describeSourceHealth(state);
    expect(description).not.toMatch(/ECONNRESET|10\.0\.0\.1/);
  });

  it("stays healthy for a single failed attempt shortly after a confirmed success", () => {
    const state = classifySourceHealth({
      lastSuccessfulRefreshAt: "2026-08-22T00:00:00.000Z",
      lastAttemptAt: "2026-08-22T00:05:00.000Z",
      lastAttemptSucceeded: false,
    });
    expect(state.status).toBe("healthy");
  });
});
