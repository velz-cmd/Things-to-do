import { describe, expect, it } from "vitest";
import { runX402MicroService } from "../../src/lib/agent/x402-micro";

describe("x402 micro-services", () => {
  it("runs docs-review with structured summary", () => {
    const result = runX402MicroService(
      "docs-review",
      "Add migration guide for React 19 concurrent features.",
    );
    expect(result?.summary).toContain("words");
    expect(result?.priceUsd).toBe(0.02);
  });

  it("runs security-signal CVE extraction", () => {
    const result = runX402MicroService(
      "security-signal",
      "CVE-2024-1234 critical RCE in react-server-dom-webpack",
    );
    expect(result?.payload.cves).toContain("CVE-2024-1234");
  });
});
