import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 6 regression guard: the server already computed real cursor-based
 * pagination (MarketplacePage.nextCursor/total) and /api/discover/opportunities
 * already served it - this was simply never surfaced in the UI, so any
 * result set beyond one page silently truncated with no way to see more
 * (a real "unbounded array, no stable page semantics" gap). Static source
 * check (matching the existing discover-media-work-row.test.ts pattern)
 * because this repo has no React component test harness.
 */
describe("Verified Work surfaces real pagination instead of silently truncating", () => {
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

  it("ForYouView reads the server's real nextCursor, never inventing pagination state", () => {
    const body = extractFunction("ForYouView");
    expect(body).toContain("data.opportunities.nextCursor");
  });

  it("loadMore() calls the real /api/discover/opportunities endpoint with the real cursor", () => {
    const body = extractFunction("ForYouView");
    expect(body).toContain("/api/discover/opportunities?");
    expect(body).toContain('params.set("cursor", cursor)');
  });

  it("a Load more affordance is only rendered when a real next page exists", () => {
    const body = extractFunction("ForYouView");
    const cursorGateIndex = body.indexOf("{cursor ? (");
    const buttonIndex = body.indexOf("Load more (");
    expect(cursorGateIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(cursorGateIndex).toBeLessThan(buttonIndex);
  });

  it("a real load failure is surfaced to the user, never silently swallowed", () => {
    const body = extractFunction("ForYouView");
    expect(body).toContain("loadMoreError");
    expect(body).toContain("catch (cause)");
  });
});
