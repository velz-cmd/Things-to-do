import { describe, expect, it } from "vitest";
import { CAPITAL_SECTIONS, PRODUCT_NAV } from "@/components/resolve/layout/nav";

describe("Capital and Profile information architecture", () => {
  it("keeps Earn and restores Profile as separate primary destinations", () => {
    const labels = PRODUCT_NAV.map((item) => item.label);

    expect(labels).toContain("Earn");
    expect(labels).toContain("Profile");
    expect(PRODUCT_NAV.find((item) => item.label === "Profile")?.href).toBe("/profile");
    expect(PRODUCT_NAV.find((item) => item.label === "Earn")?.href).toBe("/earn");
  });

  it("keeps the canonical four-part Capital operating model", () => {
    expect(CAPITAL_SECTIONS.map((section) => section.id)).toEqual([
      "treasury",
      "pending",
      "claims",
      "history",
    ]);
  });
});
