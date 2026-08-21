import { describe, expect, it } from "vitest";
import { summarizeAgentResult } from "@/lib/discover/marketplace/query";

/**
 * The invocation ledger used to persist only { url } for a purchased Agent
 * service - the actual structured result (citation resolution, security
 * signal, etc.) was returned to the caller once and then discarded, so it
 * could never survive a page refresh or be reused. commerce.ts now persists
 * { url, result: pay.data } instead. This covers the read side: turning
 * that persisted result back into the human summary Activity shows.
 */
describe("summarizeAgentResult", () => {
  it("reads the shared x402 micro-service result shape (summary field)", () => {
    const result = {
      service: "citation-verify",
      summary: "Citation identifier found · DOI 10.1038/nature12373",
      payload: { verified: true },
    };
    expect(summarizeAgentResult(result)).toBe(
      "Citation identifier found · DOI 10.1038/nature12373",
    );
  });

  it("returns null for a persisted record with no result (pre-fix rows, or url-only)", () => {
    expect(summarizeAgentResult(null)).toBeNull();
    expect(summarizeAgentResult(undefined)).toBeNull();
    expect(summarizeAgentResult({ url: "https://example.com" })).toBeNull();
  });

  it("never renders raw JSON when summary is missing or blank", () => {
    expect(summarizeAgentResult({ payload: { verified: true } })).toBeNull();
    expect(summarizeAgentResult({ summary: "   " })).toBeNull();
    expect(summarizeAgentResult({ summary: 42 })).toBeNull();
  });

  it("truncates an unexpectedly long summary rather than overflowing the Activity row", () => {
    const long = "x".repeat(500);
    const summarized = summarizeAgentResult({ summary: long });
    expect(summarized).not.toBeNull();
    expect(summarized!.length).toBeLessThanOrEqual(200);
  });
});
