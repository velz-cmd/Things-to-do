import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * discovery-service.ts holds DEMO_SUBSCRIPTIONS/DEMO_REFUNDS/DEMO_PARCELS -
 * fixture data for an unrelated "Deputy" wallet-scan feature (gated behind
 * isDeputyDemoMode), not the RESOLVE Discover marketplace. It happens to
 * share the `/api/discover/*` URL prefix by coincidence. This locks that
 * boundary: the marketplace query/projection layer and its top-level
 * component must never import it, so a future refactor can't accidentally
 * wire demo data into the customer-facing marketplace.
 */
describe("Discover marketplace fixture-leakage boundary", () => {
  const FORBIDDEN_IMPORT = /discovery-service/;

  it("never imports the unrelated Deputy demo-data module from the marketplace query layer", () => {
    const source = readFileSync("src/lib/discover/marketplace/query.ts", "utf8");
    expect(FORBIDDEN_IMPORT.test(source)).toBe(false);
  });

  it("never imports the unrelated Deputy demo-data module from the marketplace UI", () => {
    const source = readFileSync(
      "src/components/resolve/discover/marketplace/discover-marketplace.tsx",
      "utf8",
    );
    expect(FORBIDDEN_IMPORT.test(source)).toBe(false);
  });

  it("never imports the unrelated Deputy demo-data module from the Discover page route", () => {
    const source = readFileSync("src/app/(shell)/discover/page.tsx", "utf8");
    expect(FORBIDDEN_IMPORT.test(source)).toBe(false);
  });
});
