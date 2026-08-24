import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard: media (ListenBrainz) rows must render through a
 * dedicated MediaWorkRow, never the generic WorkRow fallback that renders
 * a GitBranch icon and GitHub-shaped payout/coverage copy for every
 * non-special-cased source type. A media row is one specific, timestamped
 * playback observation - visually implying "this is a GitHub thing" via a
 * leaked icon would misstate what the row actually is. Static source check
 * (matching the existing discover-activity-shared-market.test.ts pattern)
 * because this repo has no React component test harness.
 */
describe("Media rows render through a dedicated component, never the generic GitHub-shaped WorkRow", () => {
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

  it("WorkRow dispatches listenbrainz_listen items to MediaWorkRow before reaching the generic GitBranch row", () => {
    const body = extractFunction("WorkRow");
    const dispatchIndex = body.indexOf('work.source.type === "listenbrainz_listen"');
    const gitBranchIndex = body.indexOf("<GitBranch");
    expect(dispatchIndex).toBeGreaterThan(-1);
    expect(gitBranchIndex).toBeGreaterThan(-1);
    expect(dispatchIndex).toBeLessThan(gitBranchIndex);
  });

  it("MediaWorkRow never renders the GitBranch icon or a fabricated funding CTA", () => {
    const body = extractFunction("MediaWorkRow");
    expect(body).not.toContain("GitBranch");
    expect(body).not.toContain("discover.fund_verified_work");
  });

  it("MediaWorkRow surfaces a real deterministic uncertainty (riskFlags) instead of populating an invisible field", () => {
    const body = extractFunction("MediaWorkRow");
    expect(body).toContain("work.riskFlags");
  });

  /**
   * Phase 5 Release Slice 3: the row must read its funding-state line from
   * the canonical projection (economicState), never a second, separately
   * invented funding label - that duplication is exactly the "Verified
   * Work says one thing, Command Centre says another" risk Phase 5 exists
   * to close.
   */
  it("MediaWorkRow reads its funding-state line from the canonical economicState projection, not an invented label", () => {
    const body = extractFunction("MediaWorkRow");
    expect(body).toContain("canonicalStateLabel(work.economicState)");
  });
});
