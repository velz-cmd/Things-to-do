import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard: the Activity tab's confirmed-outcomes section
 * (loadConfirmedOutcomes() - network-wide, takes no viewer parameter) is
 * real shared-market data, not account history. It must never be gated
 * behind an early `if (!data.signedIn) return` the way it previously was -
 * that hid genuinely public confirmed settlements from every anonymous
 * and clean visitor. This is a static source check (matching the existing
 * fixture-leakage test pattern) because this repo has no React component
 * test harness to render OutcomesView directly.
 */
describe("Activity tab - shared market renders independent of sign-in", () => {
  const source = readFileSync(
    "src/components/resolve/discover/marketplace/discover-marketplace.tsx",
    "utf8",
  );

  function extractFunction(name: string): string {
    const start = source.indexOf(`function ${name}(`);
    expect(start, `${name} not found in discover-marketplace.tsx`).toBeGreaterThan(-1);
    const nextFn = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, nextFn === -1 ? undefined : nextFn);
  }

  it("OutcomesView no longer early-returns the whole tab when the viewer is signed out", () => {
    const body = extractFunction("OutcomesView");
    expect(body).not.toMatch(/if\s*\(!data\.signedIn\)\s*{\s*return/);
  });

  it("confirmedReceipts (network-wide settlements) is referenced outside any signedIn conditional", () => {
    const body = extractFunction("OutcomesView");
    const confirmedReceiptsIndex = body.indexOf("confirmedReceipts.length");
    const signedInSectionIndex = body.indexOf("!data.signedIn");
    expect(confirmedReceiptsIndex).toBeGreaterThan(-1);
    expect(signedInSectionIndex).toBeGreaterThan(-1);
    // The public section must render before the signed-in gate that
    // protects only the personal ledger below it.
    expect(confirmedReceiptsIndex).toBeLessThan(signedInSectionIndex);
  });

  it("SourceDiagnostics (internal connector/repo health) is gated behind sign-in, never shown to an anonymous visitor", () => {
    const start = source.indexOf("<SourceDiagnostics");
    expect(start).toBeGreaterThan(-1);
    const precedingLine = source.slice(Math.max(0, start - 120), start);
    expect(precedingLine).toContain("data.signedIn");
  });
});
