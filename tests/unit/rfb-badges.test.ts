import { describe, expect, it } from "vitest";
import { rfbBadgeForTemplate } from "../../src/lib/discover/rfb-badges";

describe("rfbBadgeForTemplate", () => {
  it("returns track label for known templates", () => {
    expect(rfbBadgeForTemplate("docs-bounty")).toEqual({
      trackLabel: "Docs",
      templateId: "docs-bounty",
    });
  });

  it("returns null for unknown templates", () => {
    expect(rfbBadgeForTemplate("unknown")).toBeNull();
  });
});
