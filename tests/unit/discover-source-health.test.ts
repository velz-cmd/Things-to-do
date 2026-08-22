import { describe, expect, it, vi, afterEach } from "vitest";
import { sourceFailure } from "@/lib/discover/marketplace/query";

/**
 * Phase 1D: source health must be honest without leaking raw engineering
 * detail. sourceFailure() already maps real error text to a small set of
 * clean, user-facing states ("timed out", "permission missing", generic
 * unavailable) and sends the actual diagnostic (URLs/secrets redacted)
 * only to console.error - this locks that behavior against regression.
 */
describe("sourceFailure - clean source health, not raw errors", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => consoleSpy.mockClear());

  it("never surfaces raw HTTP status codes or exception class names to the user-facing message", () => {
    const failure = sourceFailure(
      "test-source",
      "req-1",
      new Error("connect ECONNRESET 10.0.0.1:443"),
    );
    expect(failure.message).not.toMatch(/ECONNRESET|10\.0\.0\.1|HTTP \d{3}/);
  });

  it("maps a timeout to an honest, non-alarming user-facing message", () => {
    const failure = sourceFailure("test-source", "req-1", new Error("request timed out"));
    expect(failure.message).toBe(
      "The source refresh timed out. Last confirmed results remain available when present.",
    );
  });

  it("maps a permission error to an honest, actionable user-facing message", () => {
    const failure = sourceFailure("test-source", "req-1", new Error("403 Forbidden"));
    expect(failure.message).toBe(
      "The source is connected, but required permission is missing.",
    );
  });

  it("never leaks a raw connection string or secret, even into server logs", () => {
    sourceFailure(
      "test-source",
      "req-1",
      new Error("postgres://user:pass@host:5432/db failed, key sk_live_abc123"),
    );
    const loggedPayload = JSON.stringify(consoleSpy.mock.calls[0]);
    expect(loggedPayload).not.toMatch(/user:pass@host/);
    expect(loggedPayload).not.toMatch(/sk_live_abc123/);
  });
});
