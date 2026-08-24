import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 5 Release Slice 4 regression guard: fundingStateLabel() (used by
 * the generic WorkRow, github_evidence's path) and
 * researchFundingStateLabel() (ResearchWorkRow's path) used to be two
 * near-identical hand-written if-chains, each independently re-deriving
 * "what funding state is this outcome in" from economicMatch fields -
 * exactly the "Verified Work says one thing, something else says another"
 * duplication Phase 5 exists to close. Both must read the canonical
 * projection first, falling back to the pre-Phase-5 logic only when
 * economicState is genuinely absent. Static source check (matching the
 * existing discover-media-work-row.test.ts pattern) because this repo has
 * no React component test harness.
 */
describe("Funding-state labels are canonicalized, not independently re-derived per row", () => {
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

  it("fundingStateLabel() (generic WorkRow) reads the canonical projection before falling back to ad-hoc logic", () => {
    const body = extractFunction("fundingStateLabel");
    const canonicalIndex = body.indexOf("canonicalStateLabel(work.economicState)");
    const fallbackIndex = body.indexOf("work.economicMatch?.overlap");
    expect(canonicalIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(canonicalIndex).toBeLessThan(fallbackIndex);
  });

  it("researchFundingStateLabel() (ResearchWorkRow) reads the canonical projection before falling back to ad-hoc logic", () => {
    const body = extractFunction("researchFundingStateLabel");
    const canonicalIndex = body.indexOf("canonicalStateLabel(work.economicState)");
    const fallbackIndex = body.indexOf("work.economicMatch?.overlap");
    expect(canonicalIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(canonicalIndex).toBeLessThan(fallbackIndex);
  });
});
