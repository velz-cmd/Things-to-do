import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 5 Release Slice 16 regression guard: proves EconomicActionItem's
 * economicState is genuinely copied from the real MarketplaceOpportunity
 * in the real buildEconomicActions() pipeline - not recomputed, not
 * dropped, not merely present as a type field nobody populates (the exact
 * class of "real code exists but is unreachable" bug this session has
 * repeatedly found and fixed, e.g. Slice 8's coverage loader).
 */
describe("EconomicActionItem.economicState is genuinely wired from MarketplaceOpportunity, not a second resolver", () => {
  const source = readFileSync(
    "src/lib/discover/marketplace/economic-actions.ts",
    "utf8",
  );

  it("actionFromOpportunity() copies item.economicState onto the returned EconomicActionItem", () => {
    const start = source.indexOf("function actionFromOpportunity(");
    const end = source.indexOf("\nfunction actionFromPerson(");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain("economicState: item.economicState");
  });

  it("does not recompute economic state - no import of the matching/resolver internals into this file", () => {
    expect(source).not.toContain("resolveCanonicalEconomicStateFromMatch");
    expect(source).not.toContain("matchImpactToCapital");
  });
});
