import { describe, expect, it } from "vitest";

import { shouldOpenPayoutDestination } from "@/components/resolve/discover/marketplace/workbench-state";

describe("Discover workbench state", () => {
  it("closes the payout drawer when another in-context action replaces it", () => {
    expect(shouldOpenPayoutDestination("payout_destination", true)).toBe(true);
    expect(shouldOpenPayoutDestination("entity_details", true)).toBe(false);
  });

  it("does not expose payout choices before authentication", () => {
    expect(shouldOpenPayoutDestination("payout_destination", false)).toBe(false);
  });
});
