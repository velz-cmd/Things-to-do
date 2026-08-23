import { describe, expect, it } from "vitest";
import { classifyFetchOutcome } from "@/lib/discover/research/provider-result";

/**
 * Phase 3 item A2: health must never be inferred from result-array
 * length. These prove the classifier itself maps real HTTP/exception
 * signals to the right status - the connectors' *Detailed functions are
 * tested separately for end-to-end behavior.
 */
describe("classifyFetchOutcome", () => {
  it("classifies HTTP 200 as ok", () => {
    const result = classifyFetchOutcome({ response: new Response(null, { status: 200 }) });
    expect(result.status).toBe("ok");
  });

  it("classifies HTTP 429 as rate_limited, not unavailable", () => {
    const result = classifyFetchOutcome({ response: new Response(null, { status: 429 }) });
    expect(result.status).toBe("rate_limited");
  });

  it("classifies HTTP 500 as unavailable", () => {
    const result = classifyFetchOutcome({ response: new Response(null, { status: 500 }) });
    expect(result.status).toBe("unavailable");
  });

  it("classifies HTTP 403 as unavailable (not rate_limited)", () => {
    const result = classifyFetchOutcome({ response: new Response(null, { status: 403 }) });
    expect(result.status).toBe("unavailable");
  });

  it("classifies a timeout/network exception as unavailable", () => {
    const result = classifyFetchOutcome({ threwTimeoutOrNetworkError: true });
    expect(result.status).toBe("unavailable");
  });

  it("never includes raw HTTP status codes or exception text in the sanitized reason", () => {
    const result = classifyFetchOutcome({ response: new Response(null, { status: 500 }) });
    expect(result.sanitizedReason).not.toMatch(/500|ECONNRESET|AbortError/);
  });
});
