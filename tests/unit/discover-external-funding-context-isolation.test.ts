import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 2 item 1 corrective guarantee: external FUNDING.yml context proves
 * only that a project publishes an external funding channel - never that
 * RESOLVE has a funding match, that money was received, or that any
 * obligation is covered. This is enforced by construction: no economic
 * decision file may read `externalFundingContext` at all. A static
 * source-text check (same pattern as discover-fixture-leakage.test.ts)
 * catches a future regression that wires it into funding logic, which a
 * runtime test over today's code cannot prove by absence alone.
 */
describe("externalFundingContext economic isolation", () => {
  const economicLogicFiles = [
    "src/lib/discover/impact/economic-matching.ts",
    "src/lib/discover/marketplace/attach-economic-match.ts",
    "src/lib/discover/marketplace/economic-actions.ts",
  ];

  it("is never referenced by any economic decision file", () => {
    for (const file of economicLogicFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("externalFundingContext");
    }
  });
});
